# ADR 0014 — Notes carry participants and link tasks by source note

**Status:** accepted (2026-09-10)

## Context

ADR 0012 removed threads. The first Notes specification grouped notes into threads: every note belonged to a thread, the list showed threads, and merge and unmerge moved notes between them. Before implementation the maintainer reviewed the workflow and decided that meeting notes are written and read one at a time; grouping adds a container the office does not think in. What the office needs on a note is who was involved, which tasks came out of it, and how it is tagged.

## Decision

- `note_threads` does not exist. `notes` is the list entity; there is no `thread_id`, no merge, no unmerge, no move-to-thread.
- Participants are people, stored in the junction `note_people (note_id, person_id)` with junction columns and a partial unique index. Participants carry no role. The projected relation is `participant` (person → note).
- Tasks relate to a note only through `tasks.source_note_id`: a task is created from a note or attached to it, and belongs to at most one note. There is no note–task junction.
- Tags stay a `text[]` on the note under the global array rules.
- Meetings do not reference notes in v1 (ADR 0012); a future contextual meeting relationship follows that decision.
- The relationship inventory in `03-data-model.md` gains `person ↔ note` (`note_people`, projected as `participant`).

## Consequences

- The entity framework's multiselect validation (`EP-A05`) becomes bulk archive and bulk tag on notes instead of merge.
- AI refine still operates on one note; the refinement table is unchanged.
- The legacy import maps each `notion_notes` row to one note.
- A person's context includes the notes they participated in without a links-table write.

## Alternatives considered

- Keep threads but hide them behind the UI: still two tables and a merge surface to test for no user-facing value.
- Model participants as contextual `about` links: would make a first-class field depend on the links core, which is not built, and would mix a structural fact with free-form links.
- Note–task junction: allows one task on several notes, but breaks the "extracted from" meaning of `source_note_id` and the tasks spec's single source chip.
