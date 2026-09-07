# ADR 0006 — Hybrid linking: structural foreign keys plus a generic entity_links graph

**Status:** superseded by ADR 0009 (2026-09-07). Kept for history; the mirror-writing approach described below is no longer the design.

## Context

The maintainer asked whether the data should be structured from the start so that anything can be linked to anything: people to tasks, tasks to meetings with people, KPIs to meetings, and so on. The predecessor grew a new nullable foreign key each time a link was needed (`tasks.committee_id`, `tasks.initiative_id`, `tasks.source_note_id`, `notes.meeting_prep_id`, …), which does not scale to a many-to-many context graph, and it also had a polymorphic `comments` table with no validation.

## Decision

Keep two kinds of relationship, with a rule for choosing:

- **Structural** relationships stay as typed foreign key columns on the owning table: ownership and primary 1:N relations that every list row shows and filters by (`tasks.committee_id`, `tasks.initiative_id`, `tasks.owner_id`, `tasks.parent_id`, `tasks.source_note_id`, `notes.thread_id`, `notes.meeting_id`, `notes.committee_id`, `notes.initiative_id`, `meetings.committee_id`, `kpis.objective_id`, `initiatives.objective_id`).
- **Contextual** relationships live in one generic `entity_links` table with a typed `relation` vocabulary, canonical ordering, a resolver registry per entity type, existence validation, and mirrored rows for the structural links that matter to "everything about X" queries.
- New relationships default to contextual. A new structural column requires an ADR amendment.

## Consequences

- Lists stay fast and typed; cross-references are unlimited without migrations.
- Every module implements a resolver and a `linkedTo` filter; this is part of the module definition of done.
- Mirroring must be kept in sync inside service transactions; tests cover it.
- The graph is queryable for later features (My Day, "prepare me for this meeting") without schema changes.
- Comments remain a separate polymorphic table because they are content, not relations.

## Alternatives considered

- **Foreign keys only**: simple, but every new pair is a migration and list joins multiply.
- **Graph only** (all relations in `entity_links`): uniform, but every list query needs joins for its primary relation, and required 1:N constraints cannot be enforced by the database.
- **A graph database**: unnecessary infrastructure for this scale.
