import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser, lockWorkspace } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { listUsers, patchUser } from '../service';
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
