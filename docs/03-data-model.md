# 03 — Data model

Source of truth for schema is `src/modules/*/schema/db.ts` (Drizzle) plus custom SQL migrations under `drizzle/`. This document is the contract those files MUST match; the schema audit compares them (including `pg_catalog` for triggers, indexes, and constraints).

## Table classes and standard columns

| Class | Tables | Required columns |
|---|---|---|
| **Entity** | tasks, notes, note_threads, committees, objectives, kpis, initiatives, meetings, people, users | `id uuid pk`, `revision int not null default 1`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_op_id` |
| **Child** (owned rows edited by users) | kpi_readings, kpi_targets, initiative_deliverables, initiative_updates, initiative_progress, meeting_agenda_items, meeting_documents, meeting_briefs, note_refinements, brief_feedback, comments, meeting_private_notes | `id`, `created_at`, `updated_at`, `created_by`, `deleted_at`, `deleted_op_id`; `revision` only where the spec says the row is inline-editable |
| **Junction** | meeting_attendees, entity_links | `created_at`, `created_by`, `deleted_at`, `deleted_op_id` |
| **History / system** | sessions, login_attempts, jobs, job_attempts, schedules, ai_invocations, audit_log, files, prep_learnings, idempotency_keys, settings, workspace | as specified per table |

Global rules:

| Rule | Detail |
|---|---|
| Identifiers | UUID v7 generated in the app by `core/db/ids.ts` (single generator). Ordering of ids is not used for business logic or authorization. |
| Timestamps | `timestamptz`. `updated_at` set by the repo update helper. |
| Revision | Optimistic concurrency token. Every update to an entity row is `… WHERE id = $1 AND revision = $2` and sets `revision = revision + 1`. Zero rows → 409. |
| Soft delete and provenance | `deleted_at` plus `deleted_op_id`. A delete operation allocates one op id, writes it to the root row and every cascaded row, and records it in `audit_log`. Restore takes an op id and restores exactly the rows carrying it whose other constraints still hold; rows deleted earlier by another op stay deleted. Purge hard-deletes rows whose `deleted_at` is older than `retention.trash_days`, children before parents, links first. |
| Archive | `archived_at` where the spec allows; reversible; independent of delete. |
| Enums | `text` with a `CHECK` generated from the Zod enum. No Postgres enum types. |
| Dates | `date` for business dates; interpreted in the workspace timezone. |
| Numbers | `numeric(14,4)` for KPI values and targets; absolute value < 10^10 enforced by CHECK. Transported as JSON numbers; the range keeps every value exactly representable as a double. Percentages `numeric(5,2)`. |
| Text | `text`; lengths enforced by Zod (`title` ≤ 500, `body` ≤ 50 000). |
| Arrays | `text[]` for tags and teams only; ≤ 10 items, each ≤ 50 chars, deduplicated case-insensitively, first spelling kept. |
| Search | Tables with `q` search declare `search_text text generated always as (…) stored` from the listed fields, normalized by `core/search` SQL function `eos_normalize(text)`, with a `gin (search_text gin_trgm_ops)` index. |
| Indexes | Every FK indexed. Composite indexes listed per table below match the default list sorts. Partial indexes exclude `deleted_at is not null`. |
| Foreign keys | `restrict` by default; `set null` for optional structural links; `cascade` only for owned children. |
| Naming | snake_case in Postgres, camelCase in TypeScript. |

## System tables

### workspace
Singleton (`id = 1`), `setup_completed_at`, `schema_version`, `maintenance_mode boolean`. Locked `FOR UPDATE` by setup and restore.

### users
`id, email unique (lowercased), name, password_hash (argon2id m=64MiB t=3 p=4), role (admin|member), is_active, last_login_at, password_changed_at, revision, created_at, updated_at`. Locale, timezone, theme live in user-scoped settings.

### sessions
`id, user_id fk cascade, token_hash unique (sha256), issued_at, last_seen_at, expires_at (sliding), absolute_expires_at, ip, user_agent, revoked_at`.

### login_attempts
`id, email, ip, succeeded, created_at`. Pruned after 30 days by `system.prune`.

### settings
`key text, scope text (workspace|user), user_id uuid null, value jsonb, updated_by, updated_at`, pk `(key, scope, coalesce(user_id, '00000000-…'))`. Values validated by the registry schema on read and write.

### idempotency_keys
`key text, user_id, request_hash, status int, body jsonb, created_at`, pk `(user_id, key)`. Pruned after 24 hours.

### jobs
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| kind | text | registry key |
| dedup_key | text null | unique partial where `status in ('queued','running')` |
| payload | jsonb | validated by the kind's Zod schema; includes `capabilityVersion` for AI kinds |
| status | text | `queued` \| `running` \| `succeeded` \| `failed` \| `cancelled` |
| priority | int default 0 | higher first |
| attempt | int default 0 | current attempt number; fencing token |
| max_attempts | int | from registry |
| run_after | timestamptz | backoff |
| deadline_at | timestamptz null | fail if not succeeded by then |
| lease_owner | text null | runner instance id |
| lease_expires_at | timestamptz null | renewed by heartbeat |
| cancel_requested | boolean default false | |
| entity_type, entity_id | text, uuid null | indexed together |
| result | jsonb null | validated by the kind's result schema |
| last_error | text null | |
| created_by | uuid null | |
| created_at, started_at, finished_at | | |

Indexes: `(status, run_after, priority desc)`, `(kind, status)`, `(entity_type, entity_id)`.

### job_attempts
`id, job_id fk cascade, attempt int, lease_owner, started_at, finished_at, status (running|succeeded|failed|abandoned), error text`. Unique `(job_id, attempt)`.

### schedules
`id, kind, cron text, timezone text, payload jsonb, enabled boolean, last_occurrence timestamptz null, created_at, updated_at`. Seeded rows: `system.backup` (daily 02:00), `system.prune` (daily 03:00), `system.files.purge` (daily 03:30), `system.files.orphan_sweep` (hourly).

### ai_invocations
`id, job_id fk null, capability, capability_version int, requested_model, effective_model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, latency_ms, status (ok|error|refused|invalid_output), error text null, estimated_cost_micros bigint, pricing_version text, created_by, created_at`.

### audit_log
`id, actor_id, action, entity_type, entity_id, op_id uuid null, diff jsonb, created_at`. Private tables are never audited. Diffs exclude fields the registry marks sensitive.

### comments
`id, entity_type (kpi|initiative|meeting), entity_id, body, created_by, created_at, updated_at, revision, deleted_at, deleted_op_id`. Existence of the target checked by the service.

### files
`id, storage_key unique, original_name, mime, size_bytes, sha256, page_count int null, availability (available|purged|missing), purged_at, uploaded_by, created_at`. Rows are never soft-deleted; binaries are purged.

## Module tables

Field semantics live in the feature specs; this section fixes shape and constraints.

### people
`full_name, display_name, honorific, organization, role_title, kind (internal|external), email, phone, notes, tags, is_assignable boolean default false, user_id fk users unique null` + entity columns. Index `lower(full_name)`. `search_text` from full_name, display_name, organization, role_title, email. People are the only owner identity (ADR 0011).

### tasks
`title, description, status (inbox|next_action|waiting_on|someday|completed), priority (low|medium|high|urgent) null, due_date date null, completed_at, owner_id fk people set null, parent_id fk tasks set null, committee_id fk committees set null, initiative_id fk initiatives set null, source_note_id fk notes set null, sort_order int, search_text` + entity columns.
Constraints: trigger `tasks_depth_check` rejects a `parent_id` whose parent has a parent, and rejects updating `parent_id` on a row that has children; `CHECK ((status = 'completed') = (completed_at is not null))`; unique `(coalesce(parent_id, '0'), sort_order) where deleted_at is null` deferrable, with reorder done in one statement.
Indexes: `(status, due_date) where deleted_at is null`, `(owner_id)`, `(parent_id)`, `(committee_id)`, `(initiative_id)`, `(source_note_id)`, `(due_date, priority, created_at)`.

### note_threads
`title, search_text` + entity columns. `updated_at` bumped when a member note changes.

### notes
`thread_id fk note_threads restrict, title, content, type, note_date date, tags, committee_id set null, initiative_id set null, meeting_id fk meetings set null, archived_at, search_text` + entity columns.
Constraints: unique `(meeting_id) where deleted_at is null and meeting_id is not null` is NOT used because minutes uniqueness is per thread; instead unique `(thread_id) where meeting_id is not null` and the service ensures one minutes thread per meeting with a `meetings.minutes_thread_id` column (below).

### note_refinements
`note_id fk, job_id fk, note_revision int (revision of the note when generated), content_hash text, capability_version int, refined_content, suggested_tasks jsonb, suggested_tags text[], summary_of_changes, status (pending|applied|discarded|stale), applied_task_ids uuid[], reviewed_at, reviewed_by` + child columns. Unique `(note_id) where status = 'pending'`.

### committees
`name, description, ownership, scope (internal|external), status (active|archived), sort_order, search_text` + entity columns. Unique `lower(name) where deleted_at is null`.

### objectives
`name, description, sort_order` + entity columns.

### kpis
`name, unit, direction (higher|lower), category, objective_id fk set null, teams, notes, sort_order, freshness_days int default 120, search_text` + entity columns.

### kpi_readings
`kpi_id fk cascade, reading_date date, value numeric(14,4), note` + child columns. Unique `(kpi_id, reading_date) where deleted_at is null`.

### kpi_targets
`kpi_id fk cascade, year int, quarter int check 1..4, target_value numeric(14,4)` + child columns. Unique `(kpi_id, year, quarter) where deleted_at is null`. Zero and negative targets allowed; status rules handle them (`features/kpis.md`).

### initiatives
`name, description, status (planning|in_progress|on_hold|completed|cancelled), objective_id fk set null, teams, start_date, target_date, notes, sort_order, search_text` + entity columns. Health and progress are computed from children (no denormalized columns).

### initiative_deliverables
`initiative_id fk cascade, name, target_date, status (planned|delivered|cancelled), completed_at, sort_order` + child columns, `revision`. Lateness is computed (`status = planned and target_date < today`).

### initiative_updates
`initiative_id fk cascade, update_date date, health (on_track|at_risk|off_track), body, revision` + child columns. Latest = order by `(update_date desc, created_at desc, id desc)`.

### initiative_progress
`initiative_id fk cascade, progress_date date, planned_pct, actual_pct numeric(5,2) check 0..100, note` + child columns. Unique `(initiative_id, progress_date) where deleted_at is null`. Latest ordering as above.

### meetings
`title, starts_at, ends_at, location, committee_id fk set null, objective text, status (scheduled|held|cancelled), tags, minutes_thread_id fk note_threads set null unique, search_text` + entity columns. Index `(starts_at)`.

### meeting_private_notes
`meeting_id fk cascade, user_id fk cascade, body, updated_at, revision`, pk `(meeting_id, user_id)`. Never audited, never sent to AI, readable only by `user_id`.

### meeting_attendees
`meeting_id fk cascade, person_id fk restrict, role (chair|presenter|attendee)` + junction columns, pk `(meeting_id, person_id)`.

### meeting_agenda_items
`meeting_id fk cascade, position int, title, linked_type (kpi|initiative|task|note) null, linked_id uuid null, revision` + child columns. Unique `(meeting_id, position) where deleted_at is null` deferrable. Duplicate `(linked_type, linked_id)` within a meeting is allowed; the edge projection deduplicates.

### meeting_documents
`meeting_id fk cascade, file_id fk files restrict, display_name, position, kind (pdf|docx|md|txt), extracted_text, extraction_status (pending|done|failed|not_needed), extraction_error, page_count` + child columns. Unique `(meeting_id, file_id) where deleted_at is null`.

### meeting_briefs
`document_id fk cascade, job_id fk null, locale, version int, mode (analysis|translation), source_brief_id fk meeting_briefs null, status (generating|ready|failed), sections jsonb null (required when ready), model, capability_version, learnings_version int null, error` + child columns. Unique `(document_id, locale, version)`. Version allocated inside a transaction that locks the document row.

### brief_feedback
`brief_id fk cascade, user_id fk, rating int check 1..5, what_was_useful, what_was_wrong, what_was_missing, revision` + child columns. Unique `(brief_id, user_id) where deleted_at is null`.

### prep_learnings
`id, version int unique, status (proposed|active|rejected|superseded), base_version int null, content text (≤ 6000), source_feedback_ids uuid[], proposed_by_job_id, activated_by, activated_at, rejected_by, rejected_at, created_at`. Exactly one `active` row at any time (partial unique index). Version 0 is the seeded empty active row.

### entity_links
`source_type, source_id, target_type, target_id, relation, note text null, origin_ref text null` + junction columns. Unique `(source_type, source_id, target_type, target_id, relation) where deleted_at is null`. `CHECK (source_type <> target_type or source_id <> target_id)`. Contextual edges only; see `features/links.md` for the relation registry and the `entity_edges` view.

## Relationship inventory (authoritative)

| Relationship | Storage | Cardinality | Projected relation |
|---|---|---|---|
| task → committee | `tasks.committee_id` | N:1 | `belongs_to` |
| task → initiative | `tasks.initiative_id` | N:1 | `belongs_to` |
| task → owner person | `tasks.owner_id` | N:1 | `owner` |
| task → parent task | `tasks.parent_id` | N:1, depth 1 | not projected |
| task → source note | `tasks.source_note_id` | N:1 | `source` |
| note → thread | `notes.thread_id` | N:1 | not projected (threads aggregate notes) |
| note → committee / initiative | `notes.*_id` | N:1 | `about` |
| minutes thread → meeting | `meetings.minutes_thread_id` | 1:1 | `minutes` |
| meeting → committee | `meetings.committee_id` | N:1 | `belongs_to` |
| meeting ↔ person | `meeting_attendees` | N:M with role | `attendee` |
| meeting → agenda-linked entity | `meeting_agenda_items.linked_*` | N:M | `discussed_in` |
| kpi / initiative → objective | `*.objective_id` | N:1 | `belongs_to` |
| person ↔ user | `people.user_id` | 1:1 | not projected |
| anything ↔ anything else | `entity_links` | N:M | `related`, `requested_by`, `agreed_in`, `measures`, `about` |

Adding a relationship requires adding a row to this table in the same PR and, if structural, a new ADR.

## Migration rules

- Generated migrations via `drizzle-kit generate`; custom SQL migrations (triggers, generated columns, partial and trigram indexes, deferrable constraints) via `drizzle-kit generate --custom`, reviewed like code.
- The runner applies each migration once, in order, under `pg_advisory_lock(7231)`, and records it in Drizzle's migrations table. Migrations are forward-only. Rollback is restore from backup (ADR 0008).
- Never edit a committed migration.
- `pnpm db:reset` produces a database identical to production migrations. The schema audit runs `drizzle-kit check`, applies migrations to an empty database, and compares `information_schema` and `pg_catalog` (triggers, indexes, constraints) with `schema/db.ts` and this document's relationship inventory.
- Seed data (`scripts/db/seed.ts`) is for development and e2e only: one admin, six people (three assignable), two committees, one objective, three KPIs with readings and targets, two initiatives, three meetings (past with minutes and actions, today with a sample PDF and fixture brief, next week), links across them, twenty tasks. `--large` multiplies entities for performance checks. No real names.

## Import from legacy Mission Control

`scripts/db/import-mission-control.ts` maps the legacy schema to this one (integer ids to UUID v7, `task_owners` to assignable people, `notion_notes` to threads and notes, `strategy_*` tables to objectives, KPIs, initiatives). Optional, documented in its header, not part of the product surface. Rights to reuse any legacy code are a separate decision recorded in the roadmap.
