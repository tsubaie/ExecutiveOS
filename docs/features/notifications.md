# Feature: Notifications

**Status:** accepted
**Spec reviewed:** 2026-09-15
**Implementation verified:** not yet
**Owner module:** `src/modules/notifications`

## Purpose

What arrived for **me** since I last looked. Home answers "what needs attention" for the workspace
and holds no per-reader state; the audit log answers "what happened" for an administrator and is
append-only and complete. Neither is addressed to a person and neither can be dismissed. This is
(ADR 0022) in-app and pull-only: nothing here reaches the reader outside the application.

## Concepts and vocabulary

- **Notification** — one stored row addressed to one user about one subject.
- **Kind** — what happened, owned by the module that emits it (`task.assigned`, `note.mentioned`).
- **Subject** — the record it is about, as `subject_type` + `subject_id`. Not a foreign key: the
  feed resolves subjects through the owning module at read time.
- **Recipient** — a user, resolved from a person through `people.user_id`. A person with no account
  is never a recipient.
- **Emitter** — the service call that writes the notification inside its own transaction.

## Data model

New table `notifications` (`03-data-model.md`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid not null → `users.id` on delete cascade | the recipient |
| `kind` | text not null | check constraint over the registered kinds |
| `subject_type` | text not null | module id of the subject |
| `subject_id` | uuid not null | |
| `payload` | jsonb not null default `{}` | what changed; never a copy of the record's text |
| `actor_id` | uuid → `users.id` on delete set null | who caused it, null for scheduled kinds |
| `created_at` | timestamptz not null default now() | |
| `read_at` | timestamptz | null while unread |

Indexes: `(user_id, read_at, created_at desc)` for the feed; a unique partial index
`(user_id, kind, subject_id) where read_at is null`.

- NOTIF-I01 A row is addressed to exactly one user; fan-out writes one row per recipient.
- NOTIF-I02 At most one **unread** row per `(user_id, kind, subject_id)`, enforced by the unique
  partial index. Emission is therefore an upsert and is idempotent.
- NOTIF-I03 `kind` is one of the kinds declared by a module in its `ServerManifest`, enforced by a
  check constraint kept in step with the registry by an audit item.
- NOTIF-I04 A reader never reads another reader's rows: every query is scoped by `user_id` from
  `ctx`, never from a parameter.

## Behaviors

- NOTIF-B01 **Emission is in-transaction.** An event notification is written by the service call
  that caused it, in the same transaction, so it is exactly as durable as the change it reports.
- NOTIF-B02 **A reader is never notified of their own action.** When the actor resolves to the same
  user as the recipient, nothing is written. Assigning yourself a task is not news.
- NOTIF-B03 **Re-notifying an unread subject refreshes it.** The upsert moves `created_at` forward
  and replaces `payload`; the feed shows one line, at the top. Once read, a later event about the
  same subject inserts a new row, because it is news again.
- NOTIF-B04 **Kinds shipped in v1**, each emitted by its owning module:
  - `task.assigned` — a task's owner becomes a person with an account, and the actor is someone
    else. Payload: the task title at the time.
  - `task.due_today` — scheduled; a task the reader owns is due today and not completed.
  - `task.overdue` — scheduled; a task the reader owns passed its due date.
  - `note.mentioned` — the reader's person is added to a note's participants (NOTES/ADR 0014).
  - `kpi.off_target` — a reading lands a KPI the reader owns off target, where it was not before.
  - `job.finished` — a job the reader started reached `succeeded` or `failed` (ADR 0010).
- NOTIF-B05 **Time-derived kinds come from the scheduler**, never from a request, and are keyed so
  a re-run on the same day writes nothing new (ADR 0010 dedup keys). `task.due_today` and
  `task.overdue` are the two.
- NOTIF-B06 **The feed resolves subjects at read time** through the owning module. A notification
  whose subject is deleted, trashed or no longer visible to that reader is omitted from the feed
  and counted in neither total. It is not deleted: the subject may be restored.
- NOTIF-B07 **Reading.** Opening the centre does not mark anything read. A notification is marked
  read when the reader opens it, or by "Mark all as read" which marks exactly the rows currently
  resolvable in the feed. Read is not reversible in v1.
- NOTIF-B08 **The unread count** is of resolvable unread rows, capped in display at 99+. It is the
  only number the bell shows.
- NOTIF-B09 **Opening a notification** marks it read and navigates to its subject the way a search
  hit does (SEARCH-B07), then the centre closes.
- NOTIF-B10 **Retention** runs on the scheduler: read rows deleted after 30 days, unread after 180.
  The constants live in `src/core/config`; they are not settings.
- NOTIF-B11 **Refresh cadence** matches lists (`05`): on window focus and every 60 seconds while
  visible. There is no socket and no push.
- NOTIF-B12 **Empty state** names the purpose — nothing has arrived — and offers nothing, because
  there is no action that creates a notification.
- NOTIF-B13 Deactivating or deleting a user cascades their rows. Unlinking a person from a user
  stops future notifications and leaves existing ones addressed to that user.

## API

- `GET /api/v1/notifications?cursor=&limit=` → `{ data: { items, unread, nextCursor } }`
- `POST /api/v1/notifications/:id/read` → `{ data: { id, readAt } }`
- `POST /api/v1/notifications/read-all` → `{ data: { marked: number } }`

Both writes take an `Idempotency-Key` (`04-api-conventions.md`). Invalidation map: either write
invalidates `["notifications", "list"]` and `["notifications", "unread"]`.

## UI

- A bell in the shell header with an unread badge. The badge is `tabular-nums` and absent at zero.
- A popover on desktop, a sheet on touch, listing notifications newest first: the subject's title,
  one line saying what happened, a relative time, and the module's icon. Unread rows carry the
  accent-soft ground the entity framework uses for a selected row; read rows are muted.
- Header of the popover: the word, the unread count, and "Mark all as read" when there is one.
- Infinite paging at 20 per page, the framework's own pattern.
- The bell's count uses `count-tick` (EP-B24) so a new arrival replaces the old figure rather than
  redrawing quietly.

## i18n notes

- One message per kind under `notifications.kind.*`, written as a sentence with the subject
  interpolated, so Arabic can order it differently: `"{actor} assigned you {title}"`.
- Relative times through `src/ui/format.ts` (`05`); absolute time in the row's `title` attribute.
- Titles of records are user content and render with `dir="auto"` inside `<bdi>`.

## Acceptance criteria

- NOTIF-A01 Member A assigns a task to member B; B's bell shows 1 and the row names A and the task.
  A's own bell is unchanged. (en, ar)
- NOTIF-A02 A reassigns the same task to B twice; B has one unread row, at the top. (en)
- NOTIF-A03 B opens the row: it navigates to the task with the record open and the badge drops to
  zero. (en, ar)
- NOTIF-A04 A task with an unread notification is trashed; the row disappears from B's feed and the
  count drops, without the row being deleted. (en)
- NOTIF-A05 Assigning a task to a person with no user account writes nothing. (en)
- NOTIF-A06 A member cannot read another member's notifications through the API. (en)

## Required scenarios

- `src/modules/notifications/tests/service.test.ts`: B01 in-transaction with a rolled-back
  mutation writing nothing; B02 self-action; B03 the upsert refreshing rather than stacking and
  inserting again once read; B07 read marking; B08 the count.
- `tests/feed.test.ts`: B06 an unresolvable subject omitted from items and from the count, and not
  deleted.
- `tests/recipients.test.ts`: B04 person→user resolution, B13 the unlinked person.
- `tests/retention.test.ts`: B10 the two windows.
- `tests/api.test.ts`: NOTIF-I04 / A06 cross-reader isolation; idempotent read-all.
- `src/modules/tasks/tests/notifications.test.ts`: `task.assigned` emitted on assignment and not on
  self-assignment; the scheduled kinds keyed per day.
- e2e `notifications.spec.ts`: A01, A03, A04 in both locales.
- Mutation targets: `emitNotification`, `resolveRecipients`, `feedPage`.

## Audit items

- No module imports `src/modules/notifications` directly; emission goes through the capability on
  `ServerManifest`.
- The `kind` check constraint lists exactly the kinds the registry declares.
- Every notification query is scoped by `ctx.user.id`; none takes a user id as a parameter.
- `src/modules/notifications` has no `fetch`, no job kind not registered in its manifest.

## Out of scope

- Push, email, SMS, daily digest, check-in (`01-vision-and-scope.md`).
- Per-kind mute or preference. If a kind is noisy the answer in v1 is to fix the kind.
- Marking read as reversible, snoozing, or notifying on comment threads.
- Notifying about records in modules not yet built (meetings, initiatives).
