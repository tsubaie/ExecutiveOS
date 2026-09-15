import 'server-only';
import type { Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
import { notificationContributors } from '@/core/modules/registry';
import {
  selectFeed,
  countUnread,
  markRead,
  markManyRead,
} from '@/core/db/notifications-repo';
import { z } from 'zod';
import type { FeedRow } from '@/core/db/notifications-repo';
import { NotificationKind, type Notification } from './schema/validation';
// ADR 0022. Core owns the rows, the read state and the feed; modules own the kinds and turn a
// subject id back into a title and a link.
// NOTIF-B06/B08: a page of the feed with its subjects resolved. Rows whose subject no longer
// resolves are dropped from `items` and subtracted from `unread`; they are not deleted, because
// the subject may be restored. The page is fetched slightly over-size so that dropping a few does
// not return a short page while more exist.
// One lookup per module rather than one per row: the page is grouped by subject type and each
// owning module is asked once for the ids it owns (NOTIF-B06).
async function resolveSubjects(
  ctx: Context,
  page: readonly { subjectType: string; subjectId: string }[],
) {
  const { resolvers } = notificationContributors();
  const byType = new Map<string, string[]>();
  for (const row of page)
    byType.set(row.subjectType, [...(byType.get(row.subjectType) ?? []), row.subjectId]);
  const subjects = new Map<string, { title: string; href: string }>();
  for (const [type, ids] of byType) {
    const resolve = resolvers.get(type);
    if (!resolve) continue;
    for (const [id, subject] of await resolve(ctx, ids)) subjects.set(`${type}:${id}`, subject);
  }
  return subjects;
}
// NOTIF-B06: a row becomes a line only if its subject still resolves. A kind the database holds
// but this build no longer declares is treated the same way -- dropped rather than rendered as
// something the reader cannot act on.
function draw(
  row: FeedRow,
  subjects: Map<string, { title: string; href: string }>,
): Notification | null {
  const subject = subjects.get(`${row.subjectType}:${row.subjectId}`);
  const kind = NotificationKind.safeParse(row.kind);
  if (!subject || !kind.success) return null;
  return {
    id: row.id,
    kind: kind.data,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: subject.title,
    href: subject.href,
    actorName: actorName(row.payload),
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}
export async function feed(ctx: Context, limit: number, cursor: string | null) {
  const before = cursor ? new Date(cursor) : null;
  if (cursor && Number.isNaN(before?.getTime())) throw new AppError('validation_failed');
  const rows = await selectFeed(ctx.db, ctx.user.id, limit + 1, before);
  const page = rows.slice(0, limit);
  const subjects = await resolveSubjects(ctx, page);
  const drawn = page.map((row) => draw(row, subjects));
  const items = drawn.flatMap((item) => (item ? [item] : []));
  const hiddenUnread = page.filter((row, index) => !drawn[index] && !row.readAt).length;
  const unread = Math.max(0, (await countUnread(ctx.db, ctx.user.id)) - hiddenUnread);
  const last = page.at(-1);
  return {
    items,
    unread,
    nextCursor: rows.length > limit && last ? last.createdAt.toISOString() : null,
  };
}
// The payload is written by the emitting service and read back out of jsonb, so it comes back as
// whatever was stored rather than as a type. It is parsed rather than asserted: a row written by
// an older build is then a missing actor, not a crash in the feed.
const Payload = z.object({ actorName: z.string() }).partial().catch({});
function actorName(payload: unknown) {
  return Payload.parse(payload).actorName ?? null;
}
export async function readOne(ctx: Context, notificationId: string) {
  const row = await markRead(ctx.db, ctx.user.id, notificationId);
  if (!row) throw new AppError('not_found');
  return { id: row.id, readAt: row.readAt?.toISOString() ?? null };
}
// NOTIF-B07: exactly the rows the reader could see. A notification whose subject has gone is not
// something they were shown, so it is not something "mark all as read" answers for.
export async function readAll(ctx: Context) {
  const page = await feed(ctx, 200, null);
  const unread = page.items.filter((item) => !item.readAt).map((item) => item.id);
  return { marked: await markManyRead(ctx.db, ctx.user.id, unread) };
}
