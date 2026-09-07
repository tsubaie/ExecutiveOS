import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { settings } from './system-schema';
import { db, type Database } from './client';
import { settingsRegistry, type SettingKey, type SettingValue } from '@/core/config/settings';
export async function readSettings(database: Database = db()) {
  return database.select().from(settings);
}
async function selectValue(database: Database, key: string, userId: string | null) {
  const [row] = await database
    .select()
    .from(settings)
    .where(
      and(eq(settings.key, key), userId ? eq(settings.userId, userId) : isNull(settings.userId)),
    );
  return row?.value;
}
// Typed read: the registry schema and default are applied once, here.
export async function getSetting<K extends SettingKey>(
  database: Database,
  key: K,
  userId: string | null = null,
): Promise<SettingValue<K>> {
  const item = settingsRegistry[key];
  const stored = await selectValue(database, key, userId);
  const parsed = item.schema.safeParse(stored ?? item.default);
  return z
    .custom<SettingValue<K>>()
    .parse(parsed.success ? parsed.data : item.schema.parse(item.default));
}
// Whether a user-scoped row exists, so callers can fall back to the workspace value.
export async function hasSetting(database: Database, key: SettingKey, userId: string) {
  return (await selectValue(database, key, userId)) !== undefined;
}
export async function writeSetting<K extends SettingKey>(
  database: Database,
  key: K,
  value: SettingValue<K>,
  actorId: string,
  userId: string | null = null,
) {
  const stored = z.json().parse(settingsRegistry[key].schema.parse(value));
  const predicate = and(
    eq(settings.key, key),
    userId ? eq(settings.userId, userId) : isNull(settings.userId),
  );
  const rows = await database
    .update(settings)
    .set({ value: stored, updatedBy: actorId, updatedAt: new Date() })
    .where(predicate)
    .returning();
  if (!rows.length)
    await database.insert(settings).values({
      key,
      value: stored,
      scope: userId ? 'user' : 'workspace',
      userId,
      updatedBy: actorId,
    });
}
