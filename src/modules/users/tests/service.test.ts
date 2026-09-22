import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser, lockWorkspace } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { listUsers, patchUser, createUser } from '../service';
import { auditLog } from '@/core/db/system-schema';
import { verifyPassword } from '@/core/auth/password';
import { users } from '@/core/db/system-schema';
import { eq } from 'drizzle-orm';
const run = <T>(
  user: User,
  action: (ctx: { db: Database; user: User; requestId: string }) => Promise<T>,
) => db().transaction((database) => action({ db: database, user, requestId: id() }));
async function addUser(role: 'admin' | 'member', email: string) {
  return db().transaction(async (database) => {
    await lockWorkspace(database);
    return User.parse(
      await insertUser(database, { id: id(), name: email, email, passwordHash: 'unused', role }),
    );
  });
}
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate users, sessions, settings, audit_log cascade`);
});
afterAll(() => pool().end());
it('ADMIN-B04 the last active administrator cannot be demoted or deactivated until another exists', async () => {
  const admin = await addUser('admin', 'first@example.test');
  const patch = { name: admin.name, revision: admin.revision };
  await expect(
    run(admin, (ctx) => patchUser(ctx, admin.id, { ...patch, role: 'member', isActive: true })),
  ).rejects.toMatchObject({ code: 'rule_violation', details: { rule: 'ADMIN-B04' } });
  await expect(
    run(admin, (ctx) => patchUser(ctx, admin.id, { ...patch, role: 'admin', isActive: false })),
  ).rejects.toMatchObject({ code: 'rule_violation' });
  await addUser('admin', 'second@example.test');
  const demoted = await run(admin, (ctx) =>
    patchUser(ctx, admin.id, { ...patch, role: 'member', isActive: true }),
  );
  expect(demoted.role).toBe('member');
  expect(demoted.revision).toBe(admin.revision + 1);
});
it('ADMIN-B03 members cannot list or edit users and stale revisions conflict', async () => {
  const admin = await addUser('admin', 'admin@example.test');
  const member = await addUser('member', 'member@example.test');
  await expect(run(member, (ctx) => listUsers(ctx))).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    run(admin, (ctx) =>
      patchUser(ctx, member.id, { name: 'Renamed', role: 'member', isActive: true, revision: 99 }),
    ),
  ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'revision' } });
  const users = await run(admin, (ctx) => listUsers(ctx));
  expect(users.map((user) => user.email).sort()).toEqual([
    'admin@example.test',
    'member@example.test',
  ]);
});
it('ADMIN-B03 creating a user returns a one-time password and writes an audit record without secrets', async () => {
  const admin = await addUser('admin', 'admin@example.test');
  const { user, temporaryPassword } = await createUser(
    { db: db(), user: admin, requestId: id() },
    { name: 'New Member', email: 'new@example.test', role: 'member' },
  );
  expect(user).not.toHaveProperty('passwordHash');
  const [stored] = await db().select().from(users).where(eq(users.id, user.id));
  expect(stored && (await verifyPassword(stored.passwordHash, temporaryPassword))).toBe(true);
  const entries = await db().select().from(auditLog).where(eq(auditLog.entityId, user.id));
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ actorId: admin.id, action: 'create', entityType: 'user' });
  expect(entries[0]?.diff).toEqual({
    name: 'New Member',
    email: 'new@example.test',
    role: 'member',
  });
  expect(JSON.stringify(entries[0]?.diff)).not.toContain(temporaryPassword);
});
it('ADMIN-B03 members cannot create users', async () => {
  const member = await addUser('member', 'member@example.test');
  await expect(
    createUser(
      { db: db(), user: member, requestId: id() },
      { name: 'X', email: 'x@example.test', role: 'member' },
    ),
  ).rejects.toMatchObject({ code: 'forbidden' });
  expect(await db().select().from(users).where(eq(users.email, 'x@example.test'))).toEqual([]);
});
