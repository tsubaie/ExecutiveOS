# ADR 0022 — Notifications are a stored, per-user, pull-only feed

**Status:** accepted (2026-09-15)

## Context

`01-vision-and-scope.md` ruled notifications out of v1. What it ruled out was *delivery* — daily
check-in, push, and mail that reaches the reader where they are not. The workspace still has no
answer to a narrower question the office asks constantly: what arrived for **me** since I last
looked. Home answers "what needs attention" for the workspace and is deliberately a query with no
per-reader state; the audit log answers "what happened" for an administrator and is deliberately
append-only and complete. Neither is addressed to a person, and neither can be read and dismissed.

The scope line is amended to allow an in-app centre and to keep push, mail and check-in out.

Two facts about this installation shape the decision. It serves one executive office, so the
recipient set for any event is single digits, not thousands. And `people.user_id` already links the
directory identity to the login (ADR 0011), so an event that names an owner or a participant can be
resolved to an account.

## Decision

- **A notification is a stored row addressed to one user.** `notifications(id, user_id, kind,
  subject_type, subject_id, payload jsonb, created_at, read_at)`. One row per recipient rather than
  one row per event with a join table of readers: the recipient set is tiny, `read_at` is then a
  column rather than a second table, and every query the bell makes is one index scan on
  `(user_id, read_at, created_at)`.
- **Recipients are users, resolved from people.** A module names the person an event concerns and
  the fan-out resolves `people.user_id`; a person with no account is not a recipient and the event
  produces nothing. External people have no login and must never accumulate a feed.
- **Event notifications are written in the transaction that caused them.** The insert is part of
  the service call that assigned the task or added the participant, so a notification is exactly as
  durable as the change it reports and there is no window where the change is committed and the
  notification is lost. The fan-out is a handful of rows; making it a job would buy eventual
  consistency the workspace does not need and a second failure mode it would then have to show.
- **Time-derived notifications come from the scheduler,** not from a request. "Due today" and
  "became overdue" are properties of the clock, not of anything a reader did, so they are produced
  by a scheduled job under the ADR 0010 contract, keyed so that a re-run on the same day is a
  no-op.
- **Modules own their own kinds.** `ServerManifest` gains `notifications`, declaring the kinds a
  module emits and how it resolves a subject back to a title and an href, the way it already
  declares `jobs` and `homeSummary`. Core owns the table, the read state and the feed query; it
  never learns what a task is.
- **Re-notifying an unread subject refreshes rather than stacks.** A unique index on
  `(user_id, kind, subject_id) where read_at is null` makes the write an upsert that moves
  `created_at` forward. A task reassigned to the same person four times is one unread line, not
  four. Once read, a later event about the same subject is a new row, because it is news again.
- **Delivery is pull-only.** The bell is read when the reader opens it. It refetches on focus and
  on the same sixty-second cadence every list already uses (`05-ui-guidelines.md`); there is no
  socket, no service worker message, no mail. Nothing about a notification reaches the reader
  outside the application, which is what keeps the out-of-scope line intact.
- **A notification is not the record.** It stores `subject_type` and `subject_id` and no foreign
  key to five different tables. The feed resolves subjects through the owning module at read time,
  and a notification whose subject has been deleted or is no longer visible to that reader is
  dropped from the feed rather than rendered as a dead link. This also means a notification carries
  no copy of the record's text that could go stale, beyond the `payload` snapshot needed to say
  what changed.
- **Retention is bounded and unconfigurable in v1.** Read notifications are deleted after 30 days
  and unread after 180 by the same scheduled job, with the constants in `src/core/config`. They are
  not settings: a feed nobody has asked to tune is not worth a registry key, and the audit log is
  the surface that answers questions about the past.

## Consequences

- One migration: the table, its indexes, and the `kind` check constraint. No changes to any
  existing table.
- Every service that assigns work gains a notification write, which means every one of them gains a
  reason to take a `ctx` it may not have needed. That is the cost of writing in-transaction and it
  is paid once per emitting service.
- The feed is a fan-out read as well as a fan-out write: rendering ten notifications resolves
  subjects through up to five modules. The resolution is by id against tables the reader can
  already query, and the page size is small.
- A notification is per-user state, so a workspace backup now contains one reader's read marks.
  That is already true of user-scoped `settings` rows and needs no new treatment in `core/backup`.
- Because recipients are resolved through `people.user_id`, unlinking a person from a user stops
  their feed. Existing rows stay addressed to the user and are still theirs, which is correct: they
  were notified when they were the owner.
- The unique partial index makes the emitting path an upsert. Services must therefore treat
  emission as idempotent, which they already must under ADR 0010 for anything a job can retry.
- Nothing in this design prevents a later push or email transport: it would consume the same rows.
  That is deliberate, and still out of scope.

## Alternatives considered

- **Deriving the feed from the audit log.** The rows exist and it needs no table. But the audit log
  is addressed to no one, has no read state, records administrative facts a reader must not be
  shown, and is append-only for compliance reasons that a per-reader dismissible list would
  immediately violate. Two surfaces with two purposes.
- **A query-only centre, like Home.** Tempting, and it was the cheaper option considered: no table,
  no fan-out, no retention. It cannot express "since you last looked" — the one thing a
  notification centre is for. Without stored read state every line is permanent, and the bell can
  only ever count what is currently true, not what is new.
- **One row per event plus a `notification_reads` join table.** Correct for a large tenant and
  wasteful here: two tables and a join to serve a feed whose recipient list is under ten.
- **Writing notifications from a job instead of in-transaction.** Decouples the mutation from the
  fan-out, and for this workspace decouples it from nothing: the fan-out is three inserts. It would
  add a queue depth to watch and a class of silently-missing notifications.
- **A `notified_at` column on each subject table.** No new table, but it holds one mark for one
  reader and cannot represent two people notified about the same task.
