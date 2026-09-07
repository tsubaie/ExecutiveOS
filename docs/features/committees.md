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
- COMM-B03 **Detail** tabs: Tasks (`tasks?committeeId=` with band grouping, "+ Task" pre-filled), Meetings (`meetings?committeeId=` upcoming then past, "+ Meeting" pre-filled), Notes (`notes/threads?committeeId=`), Activity (`GET /committees/:id/activity`: audit entries where `entity` is the committee or an entity whose structural column references it, newest first, cursor paged, 50 per page; visible to all members; private tables never appear), Linked section.
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
