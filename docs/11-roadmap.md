# 11 — Roadmap

Phases are sequential. A phase is done when its definition of done is satisfied and the maintainer signs off. Work items are cut from the phase's deliverables. Each phase ends with the module audits for what it delivered.

## Phase 0 — Specification ✔ (revised 2026-09-07 after external review)

Deliverables: this documentation set, ADRs 0001–0011, templates, review response (`docs/REVIEW-RESPONSE.md`).

Done when: the maintainer has resolved the open decisions below that are marked "before Phase 1".

## Phase 1 — Skeleton and admin

- Scaffold per `02-architecture.md`: Next.js, strict TS, ESLint with custom rules in `tools/eslint`, dependency-cruiser, Prettier, Vitest, Playwright, knip, gitleaks, pnpm.
- `core/config`, `core/db` with Drizzle, migration runner with advisory lock, first migration (workspace, users, sessions, login_attempts, settings, idempotency_keys, jobs, job_attempts, schedules, ai_invocations, audit_log, files, people), `db:reset`, seed.
- `core/auth`: setup with token, login, logout, sessions, recovery, guards, rate limit, origin check.
- `core/http`: handler wrapper, envelopes, pagination, idempotency, client, OpenAPI.
- `core/jobs`: runner with leases and fencing, scheduler, registry, `system.noop`, `system.prune`.
- `core/files` and `core/backup`: storage, orphan sweep, backup job, restore command, manifest.
- `core/i18n`, theme, `src/ui` primitives, tokens, shell, nav, toast, confirm, markdown, chart wrappers.
- Admin module per `features/admin.md`; Users and Settings.
- All script audits and the core adversarial suite.
- Docker image and compose; `SECURITY.md`.

Done when: fresh clone → `docker compose up` → setup → login → admin pages in `en` and `ar`; backup and restore drill passes; CI green including audit self-tests and the adversarial suite.

## Phase 2 — Links, People, Tasks, Home

- `core/links` with relation registry, `entity_edges` view, context query, `LinkedSection`, cross-module search.
- People module. Tasks module with owner = people, subtasks, bands, views, grouping, trash, `tasks.breakdown`.
- Entity page framework built alongside Tasks (and validated against Notes' multiselect needs in Phase 3 before it is declared frozen).
- Home page v1 (tasks-only sections; meeting sections arrive in Phase 4).
- Legacy import for tasks, owners, people.

Done when: module audits for People and Tasks pass; framework scenarios pass; golden paths in both locales.

## Phase 3 — Notes and Committees

- Notes with threads, merge with reverse, archive, minutes column, `notes.refine`, `notes.suggest_tags`, refinement review and apply with stale detection.
- Committees with stats, tabs, activity endpoint.
- Framework multiselect finalized; framework declared frozen.

Done when: module audits pass; refine golden path e2e.

## Phase 4 — Meetings and Meeting Prep

- Meetings: attendees, agenda with linked items, private notes table, documents upload and extraction, `meetings.brief` with native PDF input, brief viewer, feedback per user, learnings proposals and activation, minutes, actions, duplicate.
- Home meeting sections. Backup extended to files (already in Phase 1; verify with documents).

Done when: module audit passes; brief golden path with fixture provider in both locales; adversarial AI fixtures pass; nightly live smoke produces a valid brief.

## Phase 5 — KPIs and Initiatives

- Objectives, KPIs with readings, targets, freshness, status classes; charts.
- Initiatives with deliverables, computed lateness, progress and updates with defined ordering, `initiatives.update_draft`; comments.
- Legacy import extended.

Done when: module audits pass; status matrix and boundary tests; e2e in both locales.

## Phase 6 — Hardening and release 1.0

Security audit, i18n audit, `audit:perf` with `--large`, restore and upgrade drills, export, CHANGELOG, README quick start on a clean VM, `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, issue templates, image published.

Done when: release audit passes.

## Post-1.0 candidates

Insights and daily briefing · Relationships cadence (extends People) · Daily check-in and push · Calendar and email adapters · Calendar sync for Meetings · AI-proposed links · Public API tokens · Additional locales · Second AI provider · S3-compatible storage · Multi-instance mode · Hijri display · DOCX layout-aware analysis.

## Open decisions

| Decision | Owner | Needed by | Recommendation |
|---|---|---|---|
| License | maintainer | decided 2026-09-07 | Apache-2.0 (`LICENSE`, `NOTICE` committed) |
| Product name and domain | maintainer | Phase 6 | keep "ExecutiveOS" pending trademark check |
| Maintainer's own hosting target | maintainer | Phase 1 | Linux VPS with Docker; the 1-vCPU blog VPS is too small for builds, so build images in CI |
| Legacy code reuse rights | maintainer | decided 2026-09-07 | statement recorded in `NOTICE` |
| Comments in 1.0 | maintainer | Phase 5 | keep; the table is small and specified |
