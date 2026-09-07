import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../client';
import { migrateDatabase } from '../migrate';
import { setSetupToken, lockWorkspace } from '../auth-repo';
import { digest, token } from '@/core/auth/password';
import { jobs, jobAttempts, schedules } from '../system-schema';
import { setup, patchUser } from '@/modules/users/service';
import { createPerson, patchPerson, removePerson, restorePerson } from '@/modules/people/service';
import { PersonCreate } from '@/modules/people/schema/validation';
import { claim, enqueue, publish } from '../jobs-repo';
import { scheduleDue } from '@/core/jobs/scheduler';
import { id } from '../ids';
import { env } from '@/core/config/env';
import { seedPeople } from '../../../../tests/fixtures/people';
const setupToken = token();
const password = token();
const input = {
  setupToken,
  password,
  email: 'admin@example.test',
  name: 'Test Administrator',
  workspaceName: 'Test Office',
  locale: 'en' as const,
  timezone: 'UTC',
  principalName: '',
};
beforeAll(async () => {
  if (!new URL(env().DATABASE_URL).pathname.endsWith('_test'))
    throw new Error('Adversarial suite requires dedicated *_test database');
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(
    sql`truncate people,users,workspace,settings,sessions,login_attempts,idempotency_keys,audit_log,jobs,job_attempts,schedules,recovery_token_uses cascade`,
  );
  await db().transaction(async (database) => {
    await lockWorkspace(database);
    await setSetupToken(database, digest(setupToken));
  });
});
afterAll(async () => {
  await pool().end();
});
it('ADMIN-B01 setup race allows exactly one administrator; ADMIN-B04 protects last active admin', async () => {
  const results = await Promise.allSettled([setup(input), setup(input)]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const result = results.find((result) => result.status === 'fulfilled');
  if (!result || result.status !== 'fulfilled') throw new Error('No setup winner');
  const user = result.value.user;
  await expect(
    db().transaction((database) =>
      patchUser({ db: database, user, requestId: id() }, user.id, {
        name: user.name,
        role: 'member',
        isActive: true,
        revision: user.revision,
      }),
    ),
  ).rejects.toMatchObject({ code: 'rule_violation', details: { rule: 'ADMIN-B04' } });
});
it('PEOPLE-I01 PEOPLE-B01 duplicate confirmation; PEOPLE-B06 revision race and delete provenance', async () => {
  const { user } = await setup(input);
  const ctx = { db: db(), user, requestId: id() };
  const fields = PersonCreate.parse({
    ...seedPeople[0],
    displayName: null,
    honorific: null,
    email: null,
    phone: null,
    notes: null,
    tags: [],
    userId: null,
  });
  const first = await db().transaction((database) =>
    createPerson({ ...ctx, db: database }, fields),
  );
  expect(first.data).not.toBeNull();
  const duplicate = await db().transaction((database) =>
    createPerson({ ...ctx, db: database }, fields),
  );
  expect(duplicate.data).toBeNull();
  expect(duplicate.meta.possibleDuplicates).toHaveLength(1);
  const person = first.data!;
  const updates = await Promise.allSettled(
    ['First', 'Second'].map((organization) =>
      db().transaction((database) =>
        patchPerson({ ...ctx, db: database }, person.id, {
          revision: person.revision,
          organization,
        }),
      ),
    ),
  );
  expect(updates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const deletion = await db().transaction((database) =>
    removePerson({ ...ctx, db: database }, person.id, person.revision + 1),
  );
  await expect(
    db().transaction((database) => restorePerson({ ...ctx, db: database }, person.id, id())),
  ).rejects.toMatchObject({ code: 'conflict' });
  const restored = await db().transaction((database) =>
    restorePerson({ ...ctx, db: database }, person.id, deletion.opId),
  );
  expect(restored.deletedAt).toBeNull();
});
it('job lease expiry fences a late writer and rolls back its side effects', async () => {
  const queued = await db().transaction((database) =>
    enqueue(database, 'system.noop', {}, 'lease-test'),
  );
  const first = await claim('first', 'system.noop', 1, 4);
  expect(first?.id).toBe(queued.id);
  await db()
    .update(jobs)
    .set({ leaseExpiresAt: new Date(Date.now() - 1000) })
    .where(eq(jobs.id, queued.id));
  const second = await claim('second', 'system.noop', 1, 4);
  expect(second?.attempt).toBe(2);
  await expect(publish(first!, { writer: 'late' })).rejects.toThrow('fence');
  await publish(second!, { writer: 'current' });
  const [stored] = await db().select().from(jobs).where(eq(jobs.id, queued.id));
  expect(stored?.result).toEqual({ writer: 'current' });
  const attempts = await db().select().from(jobAttempts).where(eq(jobAttempts.jobId, queued.id));
  expect(attempts).toHaveLength(2);
  expect(attempts.map((row) => row.status).sort()).toEqual(['abandoned', 'succeeded']);
});
it('active dedup key returns the existing job under concurrent insert', async () => {
  const rows = await Promise.all(
    [1, 2].map(() =>
      db().transaction((database) => enqueue(database, 'system.noop', {}, 'same-key')),
    ),
  );
  expect(rows[0]?.id).toBe(rows[1]?.id);
});
it('scheduler occurrence is not repeated after its job becomes terminal', async () => {
  const now = new Date('2026-09-07T12:01:00Z');
  await db()
    .insert(schedules)
    .values({
      id: id(),
      kind: 'system.noop',
      cron: '0 * * * *',
      timezone: 'UTC',
      payload: {},
      lastOccurrence: new Date('2026-09-07T10:00:00Z'),
    });
  await scheduleDue(now);
  await db().update(jobs).set({ status: 'succeeded' });
  await scheduleDue(now);
  expect(await db().select().from(jobs)).toHaveLength(1);
});
it('migration lock serializes concurrent migrators without schema drift', async () => {
  await Promise.all([migrateDatabase(), migrateDatabase()]);
  const rows = await db().execute(
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );
  expect(rows.rows[0]).toEqual({ count: 2 });
});
