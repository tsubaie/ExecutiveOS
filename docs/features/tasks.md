# Feature: Tasks

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** core task-management slice; see ../../TASKS-HANDOFF.md for implemented and deferred requirements.
**Owner module:** `src/modules/tasks`

## Purpose

Capture everything the office must do, keep it in a GTD-style flow, and show what is overdue, due today, and waiting on others. Tasks link to committees, initiatives, meetings, people, and the notes they came from.

## Vocabulary

| Field | Values |
|---|---|
| status | `inbox` `next_action` `waiting_on` `someday` `completed` |
| priority | `low` `medium` `high` `urgent` or null; rank for sorting: urgent 4, high 3, medium 2, low 1, null 0 |
| band | `overdue` `today` `week` `later` `nodate`; rank 0..4; completed tasks have no band |
| owner | an assignable person |
| subtask | a task with `parent_id`; depth 1 |

## Data model

See `03-data-model.md` § tasks. Invariants:

- TASKS-I01 Depth: a subtask cannot have subtasks; a task with children cannot become a subtask (trigger `tasks_depth_check` and service, 422).
- TASKS-I02 No self-parent or cycles (trigger).
- TASKS-I03 `completed_at` non-null iff `status = completed` (CHECK).
- TASKS-I04 Cascade delete: deleting a parent soft-deletes its non-deleted subtasks with the same op id; restoring by op id restores exactly those; a subtask deleted earlier by its own op stays deleted.
- TASKS-I05 `sort_order` unique within a parent among non-deleted rows (deferrable partial exclusion constraint using equality operators); reorder rewrites all positions of that parent in one statement.
- TASKS-I06 Links to committee, initiative, note, owner survive soft delete of the target and are nulled on purge.

## Behaviors

- TASKS-B01 **Create** defaults: status `inbox`, no priority, owner, or date; `title` required. Optional `committeeId`, `initiativeId`, `sourceNoteId`, `parentId`, and `links: [{ type, id, relation }]` created in the same transaction (used by meetings Actions: `agreed_in`).
- TASKS-B02 **Status transitions** are allowed between any two statuses except into `completed`, which requires `POST /tasks/:id/complete`; PATCH with `status: completed` → 422 `TASKS-B02`. `complete { revision, force? }`: if the task has non-completed subtasks and `force` is false → 409 `conflict reason: "state"` with `details.openSubtasks`; with `force` the subtasks are completed too. `reopen { revision }` sets `next_action` and clears `completed_at`; it does not reopen subtasks.
- TASKS-B03 **Bands** computed by one function `bandOf(task, today)` where `today` is the date in `ctx.timezone`: completed → none; `due < today` overdue; `= today` today; `today < due ≤ today + 7 days` week (rolling); `> today + 7` later; null → nodate. The UI recomputes bands at the next local midnight without reload (a timer keyed on the day) and refetches counts.
- TASKS-B04 **Views**: `inbox`, `next`, `today` (band today or overdue, not completed), `upcoming` (band week), `overdue` (overdue band only, from Mission Control’s dedicated overdue view), `waiting`, `someday`, `completed` (completed within 90 days), `trash`, `all` (not completed). Default: `today` if its count > 0 else `next`. Subtasks appear in lists only when `parentId` is set or `includeSubtasks=true`; counts exclude subtasks.
- TASKS-B05 **Facets**: owner, priority, committee, initiative, hasSubtasks, dueFrom/dueTo, `linkedTo`, `relation`. AND semantics.
- TASKS-B06 **Search** on title and description via `search_text`.
- TASKS-B07 **Sort** default `(band_rank, due_date asc nulls last, priority_rank desc, created_at desc, id desc)`; allowed: `due_date`, `priority`, `created_at`, `updated_at`, `title` each with `id` tiebreak.
- TASKS-B08 **Subtasks**: created from detail; checklist with complete toggle (goes through `complete`), owner, due date; reorder by drag with keyboard alternative. `POST /tasks/:id/convert-to-task { revision }` clears `parent_id` and appends to the top-level order. `POST /tasks/:id/make-subtask { revision, parentId }` requires the task to have no children and the parent to be top-level (I01).
- TASKS-B09 **Group** `POST /tasks/group { title, childIds }` creates a parent and re-parents in one transaction; any child that has children or already has a parent → 422 `TASKS-B09` naming the ids; order preserved as given.
- TASKS-B10 **Owner**: only assignable people; changing owner is a plain PATCH. Owner edge is projected (no mirror writes).
- TASKS-B11 **Trash**: soft delete with op id; `trash` view lists top-level deleted tasks with their subtasks; restore by op id; purge after retention.
- TASKS-B12 **Concurrency**: PATCH and actions carry `revision`.
- TASKS-B13 **AI breakdown** `POST /tasks/:id/breakdown { revision }` enqueues `ai.tasks.breakdown` (dedup per task). Allowed only when the task is top-level, not completed, and has no subtasks; otherwise 422 `TASKS-B13`. The job result is up to 8 suggestions; `POST /tasks/:id/breakdown/apply { jobId, indexes[] }` (idempotent, requires the task revision recorded in the job payload; stale → 409) creates the selected subtasks once; a second apply with the same job returns the existing subtasks.
- TASKS-B14 **Linked section** on detail; `linkedTo` and `relation` on lists.
- TASKS-B15 **Invalidation**: any task mutation invalidates `tasks.list*`, `tasks.counts`, `tasks.detail(id)` and the parent's detail; changes to `committee_id`, `initiative_id`, or `owner_id` also invalidate the old and new target's `detail`; link changes invalidate both `links` keys.

## API

| Verb | Path | Body / query |
|---|---|---|
| GET | `/tasks` | `view, q, ownerId, priority, committeeId, initiativeId, parentId, includeSubtasks, hasSubtasks, dueFrom, dueTo, linkedTo, relation, sort, limit, cursor, withTotal` |
| POST | `/tasks` | `TaskCreate` (+ `links`) |
| GET | `/tasks/:id` | includes `subtasks[]`, `owner`, `committee`, `initiative`, `sourceNote`, `pendingBreakdownJobId` |
| PATCH | `/tasks/:id` | `TaskUpdate` + `revision` |
| DELETE / restore | `/tasks/:id` | |
| POST | `/tasks/:id/complete` `reopen` `convert-to-task` `make-subtask` `breakdown` `breakdown/apply` | |
| POST | `/tasks/group` | |
| PATCH | `/tasks/reorder` | `{ parentId | null, orderedIds }` |

## UI

Row: checkbox (complete), title (`dir="auto"`), due label (relative, absolute on hover), priority chip, owner avatar, link chips, subtask progress. Grouping by band except in completed and trash. Detail: title, status, priority, owner, due date, committee, initiative, description (markdown), subtasks, "Break down with AI", source note chip, Linked section, metadata, actions. Create: title, due, priority, owner, committee, initiative; pre-filled links shown as chips. Mobile: swipe reveals Complete and Delete. Shortcuts: `c` complete, `d` due date, `p` priority.

## AI

`tasks.breakdown`: input `{ title, description, dueDate, assignablePeople: string[], locale }`; output `{ subtasks: { title (≤ 120), description?, dueDate? }[] (1..8) }` with `dueDate ≤ parent due date` enforced post-parse (violations dropped with a warning). Fixtures `tasks.breakdown.v1.en.json`, `.ar.json`, `.adversarial.json` (description tries to add a "delete all tasks" step; assert it is a plain subtask suggestion, not an action).

## Acceptance criteria

- TASKS-A01 A task created with only a title appears in Inbox and All with counts updated. (en, ar)
- TASKS-A02 A task due today is under Today; at local midnight the open UI moves it to Overdue within 60 seconds and counts update. (en)
- TASKS-A03 Completing a parent with open subtasks is refused with the count; confirming with force completes all. (en, ar)
- TASKS-A04 Deleting a parent moves it and its subtasks to Trash; restoring brings back exactly those; a subtask deleted earlier stays deleted. (en)
- TASKS-A05 Grouping three top-level tasks produces one parent with three ordered subtasks; grouping a task that has children is refused naming it. (en)
- TASKS-A06 Breakdown shows suggestions; applying two creates exactly two subtasks; applying again creates none. (en, ar)
- TASKS-A07 With AI disabled the breakdown button is absent and the route returns 503. (en)
- TASKS-A08 `tasks?linkedTo=meeting:<id>&relation=agreed_in` returns the meeting's actions; assigning an owner shows the task on that person's Context tab. (en)
- TASKS-A09 Two users editing the same task: the second save gets a conflict and can reapply. (en)

## Required scenarios

- schema: enums, caps, `links` shape, reorder payload.
- service: I01–I06; B02 matrix (every from/to pair, force, reopen); B03 at 23:59:59 and 00:00:00 in two timezones and around DST; B08 conversions; B09 six failure cases; B13 apply idempotency and stale revision.
- constraints: raw SQL for depth trigger, completed CHECK, sort_order uniqueness.
- repo: each view equals count under facets; sort tuples with nulls; cursor continuation; `linkedTo`; search Arabic normalization.
- api: all endpoints per `08` item 4.
- ui: row, bands, midnight timer, detail edits, subtask toggle, breakdown apply, conflict dialog.
- ai: fixtures en/ar/adversarial; drift; request capture excludes private data; disabled.
- e2e `tasks.spec.ts`: A01–A09 in the listed locales.
- Mutation targets: `bandOf`, `completeTask`, `groupTasks`.

## Audit items

- `bandOf` has one definition used by list grouping, counts, and the UI (shared through `schema/validation.ts` pure helpers).
- View predicates and counts come from one definition.
- No date math outside `core/time`.

## Out of scope

Recurring tasks, reminders, attachments, task comments, time tracking.

## Current implementation boundary — Tasks management

The manual workflow from Mission Control's `docs/tasks-patterns.md` and `docs/notion-tasks-api.md` is implemented with ExecutiveOS UUIDs, People ownership, API envelopes, transaction guards, and localization. The predecessor's private data, Notion integration, task-owner table, fire-and-forget writes, and TailAdmin palette are not copied.

The current slice includes create/edit, status/priority/owner/date, views/counts/search/sort/cursors, completion with force confirmation, one-level subtasks, keyboard-accessible reorder, conversion to top-level, grouping, soft delete/restore, Home summaries, and assigned tasks on People detail. Deleted children of active parents are accessible through the detail's Trash disclosure. Restored rows append to the current sibling order, preserving the relative order of siblings restored together and avoiding collisions after reordering.

TASKS-B13/A06 (AI), contextual Links and future-module fields in B01/B05/B14/A08, drag/swipe/shortcut polish, top-level reorder, scheduled purge, and full acceptance/performance audits remain deferred. The disabled breakdown endpoint implements A07. Full coverage is explicitly not claimed for partially delivered IDs; see the hand-off table.

`reorder.revisions` supplies B12's revision fences for every affected child. Grouping retains the specified `childIds` request and checks eligibility under a transaction lock. The current hierarchy writes use one task advisory lock; this is conservative for a small office, not a throughput benchmark. Bands/counts refresh every 30 seconds while the list is active; the exact midnight timer is still deferred.
