import 'server-only';
import type { Context } from '@/core/auth/session';
import type { NotificationSubject } from '@/core/modules/server-manifest';
import { routes } from '@/core/routes';
import * as repo from './repo';
// ADR 0022: the module declares the kinds it emits and turns a subject id back into something the
// feed can draw. NOTIF-B06: a task the reader can no longer see resolves to nothing and its line
// is dropped rather than rendered as a dead link.
export const kinds = ['task.assigned', 'task.due_today', 'task.overdue'];
export async function resolve(ctx: Context, ids: readonly string[]) {
  const rows = await repo.selectTaskSubjects(ctx.db, ids);
  return new Map<string, NotificationSubject>(
    rows.map((row) => [row.id, { title: row.title, href: routes.tasks({ id: row.id }) }]),
  );
}
