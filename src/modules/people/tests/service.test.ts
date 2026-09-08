import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { PersonCreate, PersonListQuery } from '../schema/validation';
import { createPerson, listPeople } from '../service';
import { seedPeople } from '../../../../tests/fixtures/people';
let user: User;
const run = <T>(action: (ctx: { db: Database; user: User; requestId: string }) => Promise<T>) =>
  db().transaction((database) => action({ db: database, user, requestId: id() }));
const blanks = {
  displayName: null,
  honorific: null,
  email: null,
  phone: null,
  notes: null,
  tags: [],
  userId: null,
};
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate tasks, people, users, settings, audit_log cascade`);
  user = User.parse(
    await insertUser(db(), {
      id: id(),
      name: 'People Tester',
      email: 'p@example.test',
      passwordHash: 'x',
      role: 'admin',
    }),
  );
});
afterAll(() => pool().end());
it('PEOPLE-B08 meta.total is present only when the request asks for it', async () => {
  for (const person of seedPeople.slice(0, 2))
    await run((ctx) => createPerson(ctx, PersonCreate.parse({ ...person, ...blanks })));
  const query = (withTotal?: 'true' | 'false') =>
    run((ctx) =>
      listPeople(ctx, PersonListQuery.parse({ view: 'all', ...(withTotal && { withTotal }) })),
    );
  const asked = await query('true');
  expect(asked.meta.total).toBe(2);
  expect(asked.meta.counts.all).toBe(2);
  expect((await query('false')).meta).not.toHaveProperty('total');
  const omitted = await query();
  expect(omitted.meta).not.toHaveProperty('total');
  expect(omitted.meta.counts.all).toBe(2);
});
