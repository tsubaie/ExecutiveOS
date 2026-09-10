# Feature: People

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/modules/people`

## Purpose

People are the single identity for humans in the workspace: task owners, meeting attendees, requesters, subjects of notes, and the principal. A person may also be a member (`user_id`). Not a CRM.

## Data model

See `03-data-model.md` § people. Invariants:

- PEOPLE-I01 `full_name` required. Duplicate names are allowed; create returns `meta.possibleDuplicates` when a case-insensitive match exists and the UI asks for confirmation. Creating with `confirmDuplicate: true` proceeds.
- PEOPLE-I02 `user_id` unique: one person per member. Linking a person to a user requires admin.
- PEOPLE-I03 `is_assignable` controls whether the person appears in owner pickers; tasks already owned keep their owner when it is switched off.
- PEOPLE-I04 The principal (`workspace.principal_person_id`) cannot be deleted or merged as a source.
- PEOPLE-I05 Deleting a person soft-deletes their contextual links and attendee rows with the same op id; tasks keep `owner_id` (the owner chip renders "deleted person" until restore or reassignment).

## Behaviors

- PEOPLE-B01 **Create**: full name; kind default `external`; `is_assignable` toggle; optional link to a member (admin only).
- PEOPLE-B02 **List**: rows with avatar (initials; Arabic names use the first letter of the first two words), name, organization and role, kind chip, open task count (owner edges to non-completed tasks), next meeting date (attendee edges, `starts_at ≥ now`). Views `all` (default), `assignable`, `internal`, `external`, `trash`. Facets: tag, organization, has-open-tasks. Search: name, display name, organization, role, email. Sort: name (default), open tasks desc, next meeting asc.
- PEOPLE-B03 **Detail**: header, contact, notes, tabs Context (full `LinkedSection`), Tasks (`tasks?linkedTo=person`), Notes (latest five notes where the person is a participant, link to `notes?personId=`; NOTES-B15), Meetings (attendee edges, upcoming first).
- PEOPLE-B04 **Merge** `POST /people/merge { sourceId, targetId }`, admin only, in one transaction: attendee rows moved (a duplicate `(meeting, person)` is dropped, target's role kept); `tasks.owner_id` rewritten to target; contextual links rewritten (duplicates dropped); `user_id`: if both set and differ → 409 `conflict reason: "state"` (unlink one first); if only source set, moved. Source soft-deleted with the op id; the audit entry records the rewritten ids so the merge can be reversed by an admin within retention (`POST /people/:id/unmerge { opId }`).
- PEOPLE-B05 **Stats** for list and detail come from `entity_edges` in one aggregated query.
- PEOPLE-B07 **Delete**: deletion is confirmed through the shared entity dialog, which names the person and states that trash is reversible; the confirm control is inert while the removal is in flight so one confirmation sends one mutation. Cancel, `Esc` and the backdrop leave the person untouched.
- PEOPLE-B09 **Identity chip**: an initials avatar shown without the name beside it is a button whose accessible name is the person's full name; pressing or tapping it reveals that name in a popover, dismissed by `Esc`, by activating it again, or by pointing outside. Initials alone identify nobody — an Arabic given name reduces to a single letter — and a title tooltip never appears on touch. Where the name is already visible beside the avatar (pickers, the directory row, the person header) the avatar stays inert.
- PEOPLE-B08 **Totals**: `meta.counts` always ships; `meta.total` is present only when the request asks for it with `withTotal=true` (`04-api-conventions.md` § Lists).
- PEOPLE-B06 Invalidation: person list, detail, links of the person; on merge additionally tasks lists and meetings details touched.

## API

| Verb | Path |
|---|---|
| GET/POST | `/people` (`view, q, tag, organization, hasOpenTasks, sort, limit, cursor`) |
| GET/PATCH/DELETE/restore | `/people/:id` |
| POST | `/people/merge`, `/people/:id/unmerge` (admin) |

## Acceptance criteria

- PEOPLE-A01 Creating an assignable person makes them selectable as a task owner; assigning them shows the task in their Tasks tab and Context tab. (en, ar)
- PEOPLE-A02 Adding a person as an attendee shows the meeting in their Meetings tab. (en)
- PEOPLE-A03 Merging two people moves attendee rows, task ownership, and links; the source disappears from the directory and the merge is reversible by unmerge within retention. (en)
- PEOPLE-A04 Merging two people that are both linked to different members is refused with a clear message. (en)
- PEOPLE-A05 Creating a person with an existing name asks for confirmation and does not create a duplicate until confirmed. (en, ar)
- PEOPLE-A06 Arabic names render correct initials. (ar)

## Required scenarios

- service: I01–I05, B04 (six cases: plain, duplicate attendee, both users, only source user, principal as source, unmerge), B05.
- repo: stats in one query (query counter), views, search normalization.
- api: all endpoints, admin gating on merge and user linking.
- ui: avatar initials en/ar, duplicate confirmation, tabs, delete confirmation and cancel (B07), avatar name reveal by pointer and keyboard (B09).
- Mutation targets: `mergePeople`, `initials`, `possibleDuplicates`.

## Audit items

- No module references `task_owners` (table does not exist).
