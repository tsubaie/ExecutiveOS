import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { listSettings, updateSetting } from '../service';
let admin: User;
let member: User;
const run = <T>(
  user: User,
  action: (ctx: { db: Database; user: User; requestId: string }) => Promise<T>,
) => db().transaction((database) => action({ db: database, user, requestId: id() }));
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate users, settings, audit_log, workspace cascade`);
  admin = User.parse(
    await insertUser(db(), {
      id: id(),
      name: 'Admin',
      email: 'a@example.test',
      passwordHash: 'x',
      role: 'admin',
    }),
  );
  member = User.parse(
    await insertUser(db(), {
      id: id(),
      name: 'Member',
      email: 'm@example.test',
      passwordHash: 'x',
      role: 'member',
    }),
  );
});
afterAll(() => pool().end());
it('ADMIN-B07 settings writes go through the registry: unknown keys, invalid values and members are refused', async () => {
  await expect(
    run(admin, (ctx) => updateSetting(ctx, 'workspace.unknown', 'x')),
  ).rejects.toMatchObject({
    code: 'validation_failed',
  });
  await expect(
    run(admin, (ctx) => updateSetting(ctx, 'retention.trash_days', 0)),
  ).rejects.toThrow();
  await expect(
    run(member, (ctx) => updateSetting(ctx, 'workspace.name', 'Nope')),
  ).rejects.toMatchObject({
    code: 'forbidden',
  });
  await expect(run(admin, (ctx) => updateSetting(ctx, 'user.locale', 'ar'))).rejects.toMatchObject({
    code: 'forbidden',
  });
  const written = await run(admin, (ctx) => updateSetting(ctx, 'workspace.name', 'Audited Office'));
  expect(written).toMatchObject({ key: 'workspace.name', value: 'Audited Office' });
  const listed = await run(admin, (ctx) => listSettings(ctx));
  expect(listed.find((item) => item.key === 'workspace.name')?.value).toBe('Audited Office');
  expect(listed.find((item) => item.key === 'retention.trash_days')?.value).toBe(30);
  expect(listed.some((item) => item.key.startsWith('user.'))).toBe(false);
});
