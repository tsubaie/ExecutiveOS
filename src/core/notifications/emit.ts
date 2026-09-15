import 'server-only';
import type { Context } from '@/core/auth/session';
import type { Json } from '@/core/db/audit-repo';
import { insertNotifications, type Emission } from '@/core/db/notifications-repo';
// ADR 0022 puts the rows in core, and the write side has to be in core too. An emitting module
// calls this from inside its own service; if it reached for the notifications module instead, the
// import would run back through the registry to the module that started it -- tasks emits, the
// notifications feed resolves subjects through the registry, and the registry imports tasks. The
// read side needs the registry and the write side does not, so they are separate files.
// Recipients are user ids. Resolving a person to their account is People's work (ADR 0011) and
// core may not read a module's tables, so the emitting module resolves before it calls -- which
// also means a person with no login simply produces no recipient (NOTIF-B04).
export type Emit = {
  kind: string;
  subjectType: string;
  subjectId: string;
  payload?: Json;
  to: readonly string[];
};
// NOTIF-B01: called from inside the service call that caused the event, on that call's `ctx`, so
// the notification is written in the same transaction and is exactly as durable as the change it
// reports. NOTIF-B02: the actor is never their own recipient.
export async function emit(ctx: Context, event: Emit) {
  // NOTIF-B02: the actor is never their own recipient. Assigning yourself a task is not news.
  const recipients = new Set(event.to.filter((userId) => userId !== ctx.user.id));
  const rows: Emission[] = [...recipients].map((userId) => ({
    userId,
    kind: event.kind,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    payload: event.payload ?? {},
    actorId: ctx.user.id,
  }));
  return insertNotifications(ctx.db, rows);
}
// The scheduled kinds have no actor: the clock is not a person (NOTIF-B05). They address users
// directly, because the job already resolved who owns what.
export async function emitScheduled(ctx: Context, rows: readonly Emission[]) {
  return insertNotifications(ctx.db, rows);
}
