# ADR 0009 — Contextual links table plus a projected edges view (supersedes ADR 0006)

**Status:** accepted (2026-09-07). Supersedes ADR 0006.

## Context

ADR 0006 chose a hybrid of structural foreign keys and a generic `entity_links` table, and proposed mirroring structural relationships into the links table. The review showed the mirrors create two write authorities: a user could add or remove a mirror through the links API, agenda items and links could disagree, and synchronization inside every service transaction is a permanent source of bugs.

## Decision

- `entity_links` stores **only contextual edges** with a fixed relation vocabulary, explicit direction, allowed endpoint pairs, and uniqueness.
- Structural relationships stay on their owning tables and are **projected** into a SQL view `entity_edges` that unions contextual and structural edges with an `origin` column. All reads (context query, `linkedTo` filters, stats) use the view. Nothing writes mirrors.
- The relationship inventory in `03-data-model.md` is the finite registry: storage, cardinality, projected relation. Adding a relationship edits the inventory; adding a structural one needs an ADR.
- Classification rule: a relationship is structural when it has a required or attribute-bearing cardinality the database should enforce (1:N ownership, junction with a role, uniqueness), not merely because a list displays it.

## Consequences

- No synchronization code; the graph is always consistent with the owning tables.
- Queries over the view union several tables; indexes on each structural column keep them cheap at this scale, and `audit:perf` measures it.
- The links API rejects structural relations (422) and the UI marks structural edges as locked.

## Alternatives considered

- Mirrors with provenance and write prohibition (ADR 0006 variant): still two copies of the truth.
- Graph-only storage: cannot enforce structural constraints in the database.
