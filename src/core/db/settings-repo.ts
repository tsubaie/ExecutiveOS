import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { settings } from './system-schema';
import { db, type Database } from './client';
import type { z } from 'zod';
export async function readSettings(database: Database = db()) {
  return database.select().from(settings);
}
export async function settingValue(database: Database, key: string, userId: string | null = null) {
  const [row] = await database
    .select()
    .from(settings)
    .where(
      and(eq(settings.key, key), userId ? eq(settings.userId, userId) : isNull(settings.userId)),
    );
  return row?.value;
}
export async function writeSetting(
  database: Database,
  key: string,
  value: z.infer<ReturnType<typeof z.json>>,
  actorId: string,
  userId: string | null = null,
) {
  const predicate = and(
    eq(settings.key, key),
    userId ? eq(settings.userId, userId) : isNull(settings.userId),
  );
  const rows = await database
    .update(settings)
    .set({ value, updatedBy: actorId, updatedAt: new Date() })
    .where(predicate)
    .returning();
  if (!rows.length)
    await database
      .insert(settings)
      .values({ key, value, scope: userId ? 'user' : 'workspace', userId, updatedBy: actorId });
}
