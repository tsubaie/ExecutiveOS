# Response to the 2026-09-07 specification review

Source: `history/SPEC-REVIEW.md` (external review by Codex). Each finding below maps to a resolution and the document that now carries it. "Accepted" means the spec changed as recommended; "Accepted with change" means a different fix for the same problem; "Declined" means kept as designed with the reason.

## Blockers

| # | Finding | Resolution | Where |
|---|---|---|---|
| B1 | Backup design violates the no-CLI rule | **Accepted with change.** The rule is clarified: no separately installed tools or services, no subprocess AI; bundled `pg_dump`/`pg_restore` in the image are allowed only in `core/backup`. Migrations run through the Drizzle library. Backup manifest and write-ordering consistency specified. | ADR 0008; `02` § Links, files, backup; `AGENTS.md` |
| B2 | Atomic claims do not make execution safe | **Accepted.** Leases with heartbeat, fencing on `attempt` and `lease_owner`, atomic publication, dedup keys, cancellation, deadlines, `job_attempts`, scheduler occurrence uniqueness, kill/restart scenarios. All AI calls are jobs. | ADR 0010; `02` § Background jobs; `03` § jobs; `08` core adversarial suite |
| B3 | Competing write authorities for links | **Accepted.** No mirrors. `entity_links` holds contextual edges only; structural relations are projected through the `entity_edges` view; links API rejects structural relations; relationship inventory is the finite registry. | ADR 0009 (supersedes 0006); `features/links.md`; `03` § Relationship inventory |
| B4 | Privacy without an authorization model | **Accepted.** `meeting_private_notes (meeting_id, user_id)`; actor-aware services; private tables excluded from audit, AI inputs, other users' export; cross-path scenarios required. | `02` § Authentication; `03`; `features/meetings.md` I09; `08`; `09` D |
| B5 | File lifecycle unimplementable | **Accepted.** Briefs get `deleted_at`; `files.availability` states; purge acts on binaries not rows; upload write protocol with orphan sweep; backup manifest. | `03` § files, meeting_briefs; `features/meetings.md` B12, B19 |
| B6 | Architecture rules prohibit required code | **Accepted.** Module manifest with `schema/db.ts` and client-safe `schema/validation.ts`, `jobs.ts`, `ai/`; import matrix allows repos → `core/links`, UI → other modules' `ui/index`; dependency-cruiser on the real graph. | `02` § Module manifest; `07` § Layering |

## Architecture

| Finding | Resolution | Where |
|---|---|---|
| Instrumentation placement, startup, shutdown | Accepted: `src/instrumentation.ts`, once, not awaited, disabled in build/test, SIGTERM drain. | `02` |
| Multi-instance partially designed | Accepted: v1 is single-instance; contract stays safe; clustering out of scope. | `01`, `02`, ADR 0010 |
| Resource limits too narrow | Accepted: limits table for uploads, pages, tokens, concurrency, hashing, queue depth, quota. | `02` § Resource limits |
| Event bus as correctness boundary | Accepted: removed; explicit awaited orchestration; durable reactions are jobs in the same transaction. | `02`, `07` forbidden list |

## Data model

| Finding | Resolution | Where |
|---|---|---|
| Classification rule conceptually wrong | Accepted: classify by cardinality and constraints; finite inventory. | ADR 0009; `03` |
| "Everything about X" incomplete | Accepted: context query defined over `entity_edges`, direct only, and deduplicated. Product decision ADR 0012 removes note threading and requires every linked note to remain independently visible. | `features/links.md` B01; ADR 0012 |
| People / owners / users duplication | Accepted: `task_owners` removed; people are the owner identity; merge fully specified. | ADR 0011; `features/people.md` |
| Restore provenance | Accepted: `deleted_op_id` on all soft-deletable tables; restore by op. | `03` global rules; links B05; tasks I04 |
| Denormalized initiative fields | Accepted: removed; computed via lateral joins with explicit ordering; row lock on writes. | `features/initiatives.md`; `03` |
| Numeric precision | Accepted with change: `numeric(14,4)` with a magnitude CHECK so doubles are exact; numbers stay numbers. | `03`; `04` |
| Search and indexes aspirational | Accepted: generated `search_text`, `eos_normalize`, trigram indexes, composite indexes per default sort. | `03`; `02` § search |
| Migration policy blocks triggers | Accepted: custom SQL migrations allowed; runner applies once under advisory lock; `pg_catalog` audited. | `03` § Migration rules; ADR 0002 wording via `02` |
| Standard columns per table class | Accepted: table classes defined. | `03` |

## AI

| Finding | Resolution | Where |
|---|---|---|
| Upload limit wrong for base64 | Accepted: 20 MB binary default, 300 pages, `count_tokens` preflight, refuse rather than truncate. | `06` § Document input; `02` limits |
| Native PDF not universal | Accepted: text path labeled (`analysis_basis`); page refs range-checked and treated as claims. | `features/meetings.md`; `06` |
| DOCX conversion unresolved | Accepted: DOCX is text-only via mammoth with limits; conversion out of v1. | `01`; meetings B13 |
| Persist exact generation inputs | Accepted: payload snapshots (versions, revisions, hashes, learnings version); stale detection on apply. | `06`; notes I05; meetings B14 |
| Structured output ≠ factual correctness | Accepted: complete `BriefSections` schema; domain post-validation; eval set as a manual gate; promises relabeled as evaluation targets. | meetings schema; `06` § Testing AI; notes AI |
| Learning loop is automatic preference mutation | Accepted: proposals with base version, admin activation by CAS, reset semantics, races tested. | meetings B17–B18; admin B11 |
| Indirect injection effects | Accepted: `injection_attempts` field, adversarial fixtures, sanitized markdown with no remote images, evidence versus recommendation separation. | `06` § Safety; meetings AI |
| Cost controls incomplete | Accepted: reservations, per-capability limits, cache write tokens, effective model, pricing version, SDK retries off. | `06` § Cost; `03` ai_invocations |
| BYOK operational contract | Accepted: connection check, feature matrix, error mapping, rotation, disclosure list. | `06` § Connection check |
| Cache-hit as universal pass | Accepted: asserted only where eligible. | `06` § Testing AI |

## API and UI

| Finding | Resolution | Where |
|---|---|---|
| Response contracts conflict | Accepted: `response` schemas on every handler; declared exceptions; nested field paths; localized messages; retryability; AI codes added. | `04` |
| Cursor pagination underspecified | Accepted: explicit sort tuples, ranks, nulls, versioned cursor bound to sort and filters, day-boundary rule, counts under facets. | `04` § Lists; tasks B07 |
| Timestamp concurrency insufficient | Accepted: integer `revision` required on updates and actions; serialized autosave; idempotency keys. | `03`; `04` § Concurrency, Idempotency; entity-pages B10 |
| CSRF conditional | Accepted: same-origin only, Origin check plus header, proxy trust, tests for login, setup, uploads. | `04` § CSRF |
| Entity framework cannot implement its API | Accepted: mutation adapters, typed patch/create, multiselect, URL precedence, deleted-selection rules; built with Tasks, validated with Notes, then frozen. | `features/entity-pages.md`; roadmap |
| Cache invalidation incomplete | Accepted: invalidation contract; per-module maps; locale and user scoping; logout clearing; periodic refetch. | `04` § Cache invalidation; `05` |
| RTL and a11y need observable behavior | Accepted: timezone and locale precedence, Gregorian only, numerals, `<bdi>`, RTL chart rules, overflow and focus measurements. | `05` |

## Guidelines, tests, audits

| Finding | Resolution | Where |
|---|---|---|
| "Mechanical" rules are judgments | Accepted: every rule labeled static, runtime, or review; requirement IDs cross-referenced; dates not evidence. | `07`; `09` |
| Test counts encourage fake tests | Accepted: counts removed; scenarios named by ID; mutation tests on listed functions; audit self-tests exempted. | `08`; `09` A |
| Strongest failure modes lack contracts | Accepted: core adversarial suite (races, crash recovery, duplicates, privacy, backup consistency, setup race, migration lock). | `08` |
| Layering must follow re-exports | Accepted: dependency-cruiser on the real graph; `server-only`; bundle audit. | `07`; `09` A |
| Portability and i18n greps overclaim | Accepted: tripwires with allowed locations; typed keys and `tEnum`; ICU validation; two-configuration e2e. | `07`; `05`; `09` |
| Governance contradictions | Accepted: precedence order; assumptions versus escalation rule; ADRs superseded not edited. | `AGENTS.md`; `10` |
| Strictness adds ceremony | Accepted with change: documented cast exceptions and error narrowing; primitives and tests exempt; budgets measured in CI. | `07` |

## Feature specs

All nine specs were rewritten with invariant, behavior, and acceptance IDs and the specific gaps listed in the review addressed: entity-pages (URL precedence, deletion of selection, multiselect, overlapping saves); tasks (transition matrix, sort_order constraint, subtasks in lists, breakdown exclusions, midnight refresh deadline, apply idempotency); notes (existing-job versus pending distinction, merge and unmerge, same-note facet semantics, minutes invariant and tests); committees (activity endpoint, meetings tab, invalidation of old and new); KPIs (`no_data` and `stale` statuses, zero and negative targets, lower-direction achievement, future readings, objective deletion semantics); initiatives (ordering rule, computed lateness, reopen target status, close behavior); meetings (proposed versus agreed actions with `origin_ref`, valid request union, brief state schema, prep status precedence, per-user feedback, duplicate rules, private notes, crash recovery); people (merge conflicts, attendees, duplicates); links (direction instead of canonical ordering, structural lock, filter contract).

## Scope and product

| Finding | Resolution |
|---|---|
| v1 too large; cut KPIs and Initiatives | **Declined by the owner.** Both stay in v1 with the internal simplifications the review recommended (computed lateness, no denormalization, status classes). Sequenced last (Phase 5) so the meeting-to-action workflow ships first. |
| Missing executive entry point | Accepted: `features/home.md`. |
| Executive identity absent | Accepted: `workspace.principal_person_id`; briefs are written for the principal; learnings are office-scoped and admin-activated. |

## Open-source readiness

| Finding | Resolution | Where |
|---|---|---|
| Setup not executable as described | Accepted: setup token, required secrets, TLS via proxy, resources; README quick start corrected. | `README.md`; `02`; admin B01 |
| Account recovery and bootstrap | Accepted: setup lock, recovery token, last-admin protection, revocation matrix, absolute expiry. | `02`; admin; ADR 0005 unchanged in intent |
| Unspecified admin surfaces | Accepted: `features/admin.md` covers users, settings, AI, learnings, backups, export, jobs, audit. | |
| Upgrade and restore policy | Accepted: migration lock and interrupted-upgrade behavior; restore semantics and confirmation; drills in the release audit. | ADR 0008; `09` F |
| Backups are not export | Accepted: admin export with manifest and exclusions. | admin B14 |
| Security documentation narrower than surface | Accepted: parser limits, signature checks, CSP, download headers, service worker exclusions, `SECURITY.md`. | `09` D |
| License delayed | Partially accepted: still the owner's decision, now required before Phase 1 with a recommendation; `NOTICE` and legacy-reuse statement added to open decisions. | `11` |
| Incomplete integration signs | Accepted: module counts fixed; templates updated; "Spec reviewed" versus "Implementation verified". | templates; all specs |

## Three changes the review asked for before code

1. Relationship and lifecycle contract: done (ADR 0009, relationship inventory, deletion provenance, private tables, file states, merges).
2. Production execution contract: done (ADR 0010, ADR 0008, resource limits, snapshots).
3. Reduce v1 and make contracts consistent: contracts made consistent and audit-by-count replaced by named scenarios; the module cut was declined by the owner, with sequencing used instead.
