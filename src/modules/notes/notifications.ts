import 'server-only';
import type { Context } from '@/core/auth/session';
import type { NotificationSubject } from '@/core/modules/server-manifest';
import { routes } from '@/core/routes';
import * as repo from './repo';
// ADR 0022. NOTIF-B06: a note in trash resolves to nothing and its line is dropped from the feed.
export const kinds = ['note.mentioned'];
export async function resolve(ctx: Context, ids: readonly string[]) {
  const rows = await repo.selectNoteSubjects(ctx.db, ids);
  return new Map<string, NotificationSubject>(
    rows.map((row) => [row.id, { title: row.title, href: routes.notes({ id: row.id }) }]),
  );
}
