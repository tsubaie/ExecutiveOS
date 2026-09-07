# Feature: Links (the context graph)

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/core/links` (shared) with UI in `src/ui/links`

## Purpose

Things connect: a person to the tasks they asked for, a task to the meeting where it was agreed, a KPI to the meeting where it will be discussed. The graph has two sources: structural relationships stored on the owning tables and projected into it, and contextual links stored in `entity_links`. Both are read through one view, `entity_edges`. Only contextual links are written through the links API. ADR 0009.

## Vocabulary

- **Edge**: a row of the `entity_edges` view: `source_type, source_id, target_type, target_id, relation, origin ('structural' | 'contextual'), link_id (null for structural), note, origin_ref`.
- **Relation**: a value from the registry below. Each relation has a fixed direction (source role → target role), allowed endpoint pairs, and labels for both directions.
- **Context query**: all direct edges touching one entity, grouped, deduplicated, with note edges rolled up to their thread.

## Relation registry (`core/links/relations.ts`)

| relation | source → target | Storage | Writable via links API | Labels (en) |
|---|---|---|---|---|
| `belongs_to` | task \| note \| meeting \| kpi \| initiative → committee \| objective \| initiative | structural columns | no | "belongs to" / "contains" |
| `owner` | task → person | `tasks.owner_id` | no | "owned by" / "owns" |
| `source` | task → note | `tasks.source_note_id` | no | "extracted from" / "produced" |
| `minutes` | thread → meeting | `meetings.minutes_thread_id` | no | "minutes of" / "has minutes" |
| `attendee` | person → meeting | `meeting_attendees` (with role) | no | "attends" / "attended by" |
| `discussed_in` | kpi \| initiative \| task \| note → meeting | `meeting_agenda_items.linked_*` | no | "on the agenda of" / "discusses" |
| `related` | any → any (different ids) | `entity_links` | yes | "related to" / "related to" |
| `requested_by` | task → person | `entity_links` | yes | "requested by" / "requested" |
| `agreed_in` | task → meeting | `entity_links` | yes | "agreed in" / "agreed actions" |
| `measures` | kpi → initiative | `entity_links` | yes | "measures" / "measured by" |
| `about` | note \| meeting \| task → person \| committee \| initiative \| kpi | `entity_links` | yes | "about" / "mentioned in" |

Rules:

- LINKS-I01: a contextual link is stored with the direction the registry defines; the service rejects a pair that is not allowed for the relation (422 `LINKS-I01`).
- LINKS-I02: unique `(source_type, source_id, target_type, target_id, relation)` among non-deleted links; a duplicate insert returns 409 with the existing link id.
- LINKS-I03: self-links are rejected by CHECK and service.
- LINKS-I04: both endpoints must exist and be non-deleted at insert (404 otherwise); resolvers per type are registered in `core/links/registry.ts`.
- LINKS-I05: structural relations are never written through the links API (422 `LINKS-I05`); they change only by editing the owning entity.

## `entity_edges` view

A SQL view (custom migration) that unions:

```
select 'contextual', id, source_type, source_id, target_type, target_id, relation, note, origin_ref from entity_links where deleted_at is null
union all select 'structural', null, 'task', id, 'person', owner_id, 'owner', … from tasks where owner_id is not null and deleted_at is null
union all … tasks.committee_id, tasks.initiative_id, tasks.source_note_id
union all … notes.committee_id, notes.initiative_id
union all … meetings.committee_id, meetings.minutes_thread_id
union all … meeting_attendees (person → meeting)
union all select distinct … meeting_agenda_items (linked → meeting, deduplicated per meeting)
union all … kpis.objective_id, initiatives.objective_id
```

The view is the only read path for edges. Repos use `core/links/edges.ts` helpers (`edgesFor(type, id)`, `linkedToPredicate(type, id, relation?)`) rather than writing the union again.

## Behaviors

- LINKS-B01 **Context query** `GET /links?type&id` returns direct edges in both directions, grouped by the other endpoint's type, each with a summary from the type's resolver (title, status, date, url) and the relation label from the perspective of the queried entity. Notes are rolled up to their thread (one group entry per thread with the note ids that carry the edges). Transitive edges are not included.
- LINKS-B02 **Add link**: the `LinkedSection` add flow searches across types (`GET /search`) with a type filter, then chooses a relation from those allowed for the pair; default `related`.
- LINKS-B03 **Remove link**: only contextual edges show a remove action; structural edges show "edit on <entity>" that navigates to the owning entity.
- LINKS-B04 **List filters**: every list of a linkable type accepts `linkedTo=<type>:<id>` and optional `relation=`; the predicate uses `entity_edges` in either direction. Thread lists match any note in the thread.
- LINKS-B05 **Delete provenance**: soft-deleting an entity soft-deletes its contextual links with the same `deleted_op_id`; restoring with that op id restores those links whose opposite endpoint is currently non-deleted; links whose opposite endpoint is deleted stay deleted and are restored when that endpoint is restored (its op restores them only if they carry its op id; otherwise a repair job re-evaluates links deleted by either op). Structural edges follow their owning row automatically.
- LINKS-B06 **Purge** hard-deletes contextual links before their endpoints.
- LINKS-B07 **Search**: `GET /search?q&types` runs each resolver's search (normalized `search_text`) and returns `{ type, id, title, subtitle }`, ≤ 10 per type.
- LINKS-B08 **Audit**: link create and delete write `audit_log` entries for both endpoints.
- LINKS-B09 **origin_ref**: a contextual link MAY carry `origin_ref` (`brief:<briefId>#<itemIndex>`, `refinement:<id>#<n>`) recording what proposed it; shown as a chip.

## API

| Verb | Path | Notes |
|---|---|---|
| GET | `/links?type=task&id=` | grouped edges |
| POST | `/links` | `{ source: {type,id}, target: {type,id}, relation, note?, originRef? }`; idempotent; 201 or 409 |
| DELETE | `/links/:id` | contextual only; 204 |
| GET | `/search?q=&types=` | cross-module |

Invalidation: `["links", type, id]` for both endpoints; `detail` of both endpoints.

## UI

`LinkedSection` on every entity detail: groups by type with counts, chips with summaries, relation label, add and remove; structural edges marked with a lock icon and tooltip. Context tab on People and Meetings uses the same component in expanded mode.

## Acceptance criteria

- LINKS-A01 Linking a person to a task as `requested_by` from the task shows the task on the person's Context tab and the person on the task's Linked section; removing it from either side removes both. (en, ar)
- LINKS-A02 Adding a KPI as an agenda item makes the meeting appear under the KPI's Linked section as a structural edge with no remove action; deleting the agenda item removes the edge. (en)
- LINKS-A03 Creating a task from a meeting's Actions tab creates the task and an `agreed_in` link in one request; `tasks?linkedTo=meeting:<id>&relation=agreed_in` returns it. (en, ar)
- LINKS-A04 `tasks?linkedTo=person:<id>` returns tasks with `owner`, `requested_by`, or `about` edges to that person. (en)
- LINKS-A05 Deleting and restoring a meeting hides and restores its contextual links; a link the user removed manually before the delete stays removed after restore. (en)
- LINKS-A06 Linking to a deleted entity returns 404; an illegal pair returns 422 `LINKS-I01`. (en)

## Required scenarios

- service: I01–I05, B05 (four cases: both alive, opposite deleted, manual prior delete, restore order), B06, B08.
- repo: `edgesFor` returns structural and contextual edges; deduplicated agenda edges; `linkedToPredicate` used by tasks and threads; note rollup.
- api: all endpoints; idempotent POST; 409 existing; 404; 422.
- ui: grouping, add flow with pair validation, structural lock, remove confirm.
- Mutation targets: `validatePair`, `restoreLinksForOp`, `edgesFor`.

## Audit items

- Only `core/links` defines the union; `grep -r "entity_links" src/modules` finds no direct table references.
- Every module type has a resolver with `summaries`, `exists`, `search`, `url`.
