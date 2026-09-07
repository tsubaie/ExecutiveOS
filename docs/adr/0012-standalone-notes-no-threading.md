# ADR 0012 — Notes are standalone entities and are never threaded

**Status:** accepted (2026-09-07).

## Context

The original Notes design placed every note inside a `note_threads` container. Lists displayed threads rather than notes, users could add notes to a thread, threads could be merged and unmerged, and meeting minutes were represented by a thread structurally owned by a meeting.

That model hides the primary record behind a second entity and makes ordinary note capture behave like a conversation system. It also causes list cardinality, search results, links, task counts, archive behavior, and meeting history to operate on aggregates rather than on the note the user actually created.

The product requirement is simpler: every note must stand by itself and remain individually visible. Notes that happen to concern the same meeting, subject, date, type, committee, or initiative must not be collapsed into a thread. A meeting relationship may be considered later, but it is not part of v1 and must never reintroduce threading.

## Decision

- Every note is a first-class entity with its own list row, detail URL, revision, archive state, delete/restore lifecycle, links, task counts, and AI refinement lifecycle.
- The `note_threads` entity and `notes.thread_id` relationship do not exist in the target schema.
- Notes cannot be stacked, merged, unmerged, moved between containers, rolled up, or displayed as a thread.
- Note list filters, search, sorting, context links, and counters operate on one note at a time.
- Meetings do not own or structurally reference notes or minutes in v1. `notes.meeting_id`, `meetings.minutes_thread_id`, the Minutes tab, and minutes create/unlink endpoints are excluded from the v1 target design.
- A user may record meeting-related prose as an ordinary standalone note and classify it with a note type. That classification does not create a relationship to a meeting record.
- A future note-to-meeting relationship, if approved, must use a new decision and the relationship inventory. Every related note must still appear independently; the relationship may add context but must not alter note identity or list cardinality.
- Historical review documents and superseded ADRs remain unchanged as records of earlier decisions. Active specifications, architecture, data-model, API, testing, and roadmap documents follow this ADR.

## Consequences

- The Notes UI and API become simpler: `/notes` lists notes directly and `/notes/:id` addresses one note.
- Thread routes, thread-level controls, merge provenance, aggregation queries, and thread-specific tests are removed from the target design.
- Tasks may continue to reference one source note through `tasks.source_note_id`; counts are calculated per note.
- Committee and initiative associations remain properties of each individual note.
- Context queries return every note separately rather than rolling note edges up to a container.
- Meeting private prep notes remain a separate per-user meeting field; they are not Notes-module entities and do not create note threading.
- Implementing this accepted design will require a forward migration if thread tables or columns have already reached a deployed database. Migration must preserve every note as an independent row and must not discard thread titles without an explicit mapping decision.
- Product documentation must use “note” rather than “thread” for active behavior. Immutable historical material may still describe the superseded design.

## Alternatives considered

- **Keep one automatically created thread per note:** rejected because it preserves a meaningless container and allows threading concepts to leak back into APIs and UI.
- **Keep threads but show each note separately:** rejected because two competing identities remain and merge/group semantics still complicate links, deletion, and navigation.
- **Use a meeting as the grouping container:** rejected for v1 and incompatible with the requirement that each note remain independently visible.
- **Add a direct `meeting_id` now without threading:** deferred. A future contextual relationship may be useful, but it is not required for v1 and needs a separate product decision.
