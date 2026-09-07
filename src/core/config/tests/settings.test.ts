import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser } from '@/core/db/auth-repo';
import { getSetting, hasSetting, writeSetting } from '@/core/db/settings-repo';
import { settingKeys, settingsRegistry } from '../settings';
import { appVersion } from '../version';
import { id } from '@/core/db/ids';
import { midnightBoundaries } from '../../../../tests/fixtures/timezones';
let actor: string;
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate users, settings cascade`);
  actor = (
    await insertUser(db(), {
      id: id(),
      name: 'S',
      email: 's@example.test',
      passwordHash: 'x',
      role: 'admin',
    })
  ).id;
});
afterAll(() => pool().end());
describe('ADMIN-B07 typed settings registry', () => {
  it('rejects secret-like keys and models outside the claude-* namespace', () => {
    expect(settingKeys.some((key) => /secret|password|token$|api.?key/iu.test(key))).toBe(false);
    expect(settingsRegistry['ai.model.default'].schema.safeParse('claude-opus-5').success).toBe(
      true,
    );
    expect(settingsRegistry['ai.model.default'].schema.safeParse('gpt-5').success).toBe(false);
  });
  it('applies the schema and default when no row exists and returns typed values after a write', async () => {
    expect(await getSetting(db(), 'workspace.timezone')).toBe('UTC');
    expect(await getSetting(db(), 'retention.trash_days')).toBe(30);
    const zone = midnightBoundaries[0]?.timezone ?? 'UTC';
    await writeSetting(db(), 'workspace.timezone', zone, actor);
    expect(await getSetting(db(), 'workspace.timezone')).toBe(zone);
    expect(await hasSetting(db(), 'user.locale', actor)).toBe(false);
    await writeSetting(db(), 'user.locale', 'ar', actor, actor);
    expect(await hasSetting(db(), 'user.locale', actor)).toBe(true);
    expect(await getSetting(db(), 'user.locale', actor)).toBe('ar');
  });
  it('refuses a value that fails the key schema and ignores a stored value that no longer parses', async () => {
    await expect(writeSetting(db(), 'retention.trash_days', 0, actor)).rejects.toThrow();
    await db().execute(
      sql`insert into settings (key, scope, value) values ('retention.trash_days', 'workspace', '"many"'::jsonb)`,
    );
    expect(await getSetting(db(), 'retention.trash_days')).toBe(30);
  });
});
it('ADMIN-B12 the application version comes from package.json', () => {
  expect(appVersion).toMatch(/^\d+\.\d+\.\d+/u);
});
