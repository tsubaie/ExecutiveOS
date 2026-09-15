import 'server-only';
import { and, eq, isNull, lt, sql, desc, inArray, count } from 'drizzle-orm';
import { notifications } from './system-schema';
import { type Database } from './client';
import { id } from './ids';
import type { Json } from './audit-repo';
// ADR 0022 keeps the table in core: core owns the rows, the read state and the feed query, and
// never learns what a task is. Modules contribute kinds and resolve subjects.
export type Emission = {
  userId: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  payload: Json;
  actorId: string | null;
};
// NOTIF-I02/B03: the partial unique index makes this an upsert. Re-notifying an **unread** subject
// moves it back to the top and replaces the payload; once read, the conflict target no longer
// matches and a new row is inserted, because it is news again.
export async function insertNotifications(database: Database, rows: readonly Emission[]) {
  if (!rows.length) return 0;
  const values = rows.map((row) => ({ id: id(), ...row }));
  const written = await database
    .insert(notifications)
    .values(values)
    .onConflictDoUpdate({
      target: [notifications.userId, notifications.kind, notifications.subjectId],
      targetWhere: isNull(notifications.readAt),
      set: {
        createdAt: new Date(),
        payload: sql`excluded.payload`,
        actorId: sql`excluded.actor_id`,
      },
    })
    .returning({ id: notifications.id });
  return written.length;
}
export type FeedRow = Awaited<ReturnType<typeof selectFeed>>[number];
// NOTIF-I04: scoped by the user id from `ctx`, never from a parameter the caller chose.
export async function selectFeed(
  database: Database,
  userId: string,
  limit: number,
  before: Date | null,
) {
  return database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        before ? lt(notifications.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
// The badge counts unread rows; NOTIF-B08 then subtracts the ones whose subject no longer
// resolves, which only the feed can know.
export async function countUnread(database: Database, userId: string) {
  const [row] = await database
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}
export async function markRead(database: Database, userId: string, notificationId: string) {
  const [row] = await database
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id, readAt: notifications.readAt });
  return row ?? null;
}
// NOTIF-B07: "mark all" marks exactly the rows the reader could see, which the service resolves
// first — a notification whose subject has gone is not something they were shown.
export async function markManyRead(database: Database, userId: string, ids: readonly string[]) {
  if (!ids.length) return 0;
  const rows = await database
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        inArray(notifications.id, [...ids]),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}
// NOTIF-B10: retention. Read rows go after one window, unread after a longer one.
export async function deleteExpired(database: Database, readBefore: Date, unreadBefore: Date) {
  const rows = await database
    .delete(notifications)
    .where(
      sql`(${notifications.readAt} is not null and ${notifications.readAt} < ${readBefore})
       or (${notifications.readAt} is null and ${notifications.createdAt} < ${unreadBefore})`,
    )
    .returning({ id: notifications.id });
  return rows.length;
}
