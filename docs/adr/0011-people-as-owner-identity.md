# ADR 0011 — People are the single identity for task owners and attendees

**Status:** accepted (2026-09-07)

## Context

The first draft kept a separate `task_owners` table (from the predecessor) alongside `people` and `users`, with cross-references in both directions. The review found duplicated identity with no reconciliation rules: unique owner names versus permitted person homonyms, multiple people pointing at one owner, and no backfill on linking.

## Decision

- `task_owners` does not exist. `tasks.owner_id` references `people`. A person is assignable when `people.is_assignable` is true.
- `people.user_id` is unique and optional; linking requires admin.
- Merge semantics for people are fully specified in `features/people.md` (attendees, ownership, links, conflicting users, reversal).
- The legacy import maps old owners to assignable people.

## Consequences

- One directory, one avatar, one merge path.
- Owner pickers query people with `is_assignable`; deactivating assignability does not touch existing tasks.
