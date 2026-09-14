# Feature: Committees

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/modules/committees`

## Purpose

Boards, councils, and committees are standing bodies that generate meetings, notes, and actions. Each has one page with its open work and history.

## Data model

See `03-data-model.md` § committees. Invariants:

- COMM-I01 Name unique among non-deleted, case-insensitive (unique index; 409 `unique` mapped to `fieldErrors.name`).
- COMM-I02 Archiving does not touch linked tasks, notes, or meetings.
- COMM-I03 Soft delete keeps `committee_id` on tasks, notes, meetings (chip renders "archived"); purge nulls them.

## Behaviors

- COMM-B01 **Create**: name required; scope default `internal`; status `active`.
- COMM-B02 **List** cards: name, scope chip, ownership, open tasks, overdue tasks, next meeting date, last note date. Views `active` (default), `archived`, `all`, `trash`. Facets scope, `linkedTo`. Search name, description, ownership. Sort name (default), open tasks desc, next meeting asc, manual.
- COMM-B03 **Detail** tabs: Tasks (`tasks?committeeId=` with band grouping, "+ Task" pre-filled), Meetings (`meetings?committeeId=` upcoming then past, "+ Meeting" pre-filled), Notes (`notes?committeeId=`; one row per note), Activity (`GET /committees/:id/activity`: audit entries where `entity` is the committee or an entity whose structural column references it, newest first, cursor paged, 50 per page; visible to all members; private tables never appear), Linked section.
- COMM-B04 **Archive / unarchive / delete / restore**; reorder by drag with keyboard alternative (`PATCH /committees/reorder`).
- COMM-B05 **Stats** computed in one aggregated query over tasks, meetings, notes.
- COMM-B06 **Invalidation**: committee list and detail; task, meeting, note mutations that set or change `committee_id` invalidate the old and new committee's detail and the committee list (stats).

## API

| Verb | Path |
|---|---|
| GET/POST | `/committees` (`view, q, scope, linkedTo, sort, limit, cursor`) |
| GET/PATCH/DELETE/restore | `/committees/:id` (detail includes `stats`) |
| POST | `/committees/:id/archive` `unarchive` |
| PATCH | `/committees/reorder` |
| GET | `/committees/:id/activity` |

## Acceptance criteria

- COMM-A01 Creating a committee and adding a task from its Tasks tab shows the task there and in Tasks with the committee chip; counts on the card match Tasks' counts for the same filter. (en, ar)
- COMM-A02 Moving a task to another committee updates both cards' counts without reload. (en)
- COMM-A03 Archiving hides the committee from Active and keeps its tasks visible. (en)
- COMM-A04 Duplicate name returns a field error on the name input. (en, ar)
- COMM-A05 Activity lists the task creation and the archive action. (en)

## Required scenarios

- service: I01–I03, B05, B06 old-and-new invalidation (asserted via the invalidation map test helper).
- repo: stats one query; activity query excludes private tables and includes referenced entities.
- api: all endpoints; 409 to fieldErrors mapping.
- ui: card, tabs reuse Tasks and Meetings row components from their `ui/index`.
- e2e `committees.spec.ts`: A01–A05.
- Mutation targets: `committeeStats`, `activityQuery`, `archiveCommittee`.

## Audit items

- Tabs reuse other modules' exported row components; no duplicate row implementation.

## Current development slice — Mission Control parity

COMM-B01–B06 are being developed for Committees, Tasks and Notes using the existing entity
framework. Verification results for this slice are recorded in `docs/work-items/github-publication.md`.

- Shared horizontal cards retain rounded corners, scope groups, search, scope filtering,
  ownership, task completion/overdue counts and the latest note date. Summary cards count linked
  top-level tasks (open, completed, overdue, due today); due today means the current workspace date.
- Task and note tabs reuse `RelatedEntities`, each module's row, create form and detail panel.
  Creation starts with the committee selected; existing work is assigned or moved through the
  shared committee picker in Tasks/Notes. Both list pages offer a committee facet and a linked chip.
- The picker offers active committees and preserves an existing archived/trashed assignment.
  Archive and soft delete never change linked work. Archived/trashed committees cannot receive
  new assignments; their existing tasks and notes remain editable.
- Name conflicts return COMM-I01 as a name field error. Writes use shared revision, audit,
  idempotency and restore-operation handling. Activity includes committee and linked task/note actions.
- Broad task/note cache invalidation refreshes both old/new committee detail, lists and activity.
- The nullable indexed task/note foreign keys are introduced by migration `0008_committees.sql`.

The accepted Meetings and contextual Linked tabs/facets await those modules. No placeholder tabs
are displayed. The reorder API and manual sort are present; drag/keyboard reorder controls and
full acceptance coverage remain part of the broader accepted spec, beyond the reference task/note
workflow in this slice. Embedded tasks retain their shared due-date band grouping.
