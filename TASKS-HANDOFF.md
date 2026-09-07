# Hand-off: Task management from Mission Control

Status: manual task-management slice delivered; full Tasks specification and prior WI-0001 remain incomplete as detailed below.

## Summary

Tasks is available at **http://localhost:3000/tasks?view=all** with persistent PostgreSQL data, English/Arabic UI, People assignment, priorities, due-date views, search, inline editing, subtasks, grouping, completion, and trash/restore. Home now shows overdue/today/waiting summaries; People detail shows assigned work. The shared entity framework owns URL filters, selection, keyboard navigation, and mobile detail transitions. Revision conflicts keep pending patches and offer explicit reload/reapply; PATCH never applies create defaults to omitted fields. Existing user data was retained. No AI capability, remote, dependency package, or predecessor file was added or changed.

Requirements were read from Mission Control `docs/tasks-patterns.md`, `docs/notion-tasks-api.md`, and task scenarios in `docs/tests/tasks-notes-test-scenarios.md`. ExecutiveOS's accepted contracts govern storage, identity, API, localization, and error handling. Legacy implementation details were not copied.

## Requirement → scenario

All files below are executable scenarios, not source-string assertions. “Partial” does not claim the entire requirement is complete.

| ID | Scope | Test file | Scenario / evidence |
|---|---|---|---|
| TASKS-I01, I02 | Implemented | `src/modules/tasks/tests/service.test.ts` | Reject depth two, self parenting, converting parents; direct DB constraint rejection |
| TASKS-I03 | Implemented | same | Completion timestamp iff completed, including raw SQL rejection |
| TASKS-I04 | Implemented | same; `e2e/tasks.spec.ts` | Restore matching operation only; independently deleted child; restore after sibling reorder |
| TASKS-I05 | Subtask order implemented; top-level endpoint deferred | same | Deferred uniqueness, atomic reorder, stale child revisions refused |
| TASKS-I06 | Owner implemented; future target modules deferred | same | Owner retained through soft delete and nulled on purge |
| TASKS-B01, A01 | Core fields implemented; future links deferred | validation/service tests; `e2e/tasks.spec.ts` | Title-only Inbox/All creation, correct defaults, en/ar create flow |
| TASKS-B02, A03 | Implemented; exhaustive transition matrix not yet covered | service tests; e2e | PATCH completed → 422, unfinished children → 409, force completes all, reopen leaves children completed |
| TASKS-B03, A02 | Partial: server-derived bands refresh every 30 seconds | `src/modules/tasks/tests/validation.test.ts` | Rolling seven-day bands, midnight in two zones including DST; browser-clock midnight acceptance remains deferred |
| TASKS-B04 | Views implemented | service tests; e2e | Counts exclude subtasks; Inbox/All/Trash/Completed; dedicated Overdue view from predecessor |
| TASKS-B05 | Core API facets and owner/priority UI implemented | service tests; e2e | AND priority/date filtering; assignment navigation; future graph/module facets deferred |
| TASKS-B06 | Implemented | service tests | Arabic normalized title search and description field |
| TASKS-B07 | Implemented API sorts/cursors; exhaustive performance coverage deferred | service tests | All six sort modes continue across pages, null dates, changed cursor filters rejected |
| TASKS-B08 | Partial: create/edit/toggle/reorder/convert; make-subtask API | service tests; e2e | Child edits use child ID; button/keyboard reorder; conversion; independent child restoration |
| TASKS-B09, A05 | Implemented | service tests; e2e | Three tasks grouped in displayed order; parents with children rejected atomically |
| TASKS-B10 | Implemented | service tests; e2e | Only assignable People; assigned work appears in People detail |
| TASKS-B11, A04 | Soft delete/restore implemented; retention purge deferred | service tests; e2e | Parent cascade, operation provenance, Trash and restore |
| TASKS-B12, A09 | Row actions and reorder fenced; group eligibility locked | service tests; e2e; `src/ui/entity/tests/save-queue.test.ts` | Concurrent edits have one winner; explicit reapply uses current revision/new key and preserves unrelated fields |
| TASKS-B15 | Installed modules implemented | e2e | Mutations update task list/detail, parent, People and Home queries |
| TASKS-A07 | Implemented for the current disabled capability | e2e | No AI action in UI; authenticated breakdown returns 503 |
| EP-B01, B05, B08, B09 | Existing core behavior retained/extended | `e2e/preview.spec.ts`, `e2e/tasks.spec.ts`, entity tests | Both People and Tasks use URL state, navigation, save queue, mobile transitions; grouping selection uses URL `sel` |
| HOME-B01, B03 | Tasks portion implemented | task service tests; e2e | Task summaries have counts, five-item limits and links; task aggregator uses two queries |
| HOME-B02, A03 | Existing behavior retained | preview e2e | Four absent-module sections collapse; absent AI review section remains absent |

## Deferred specification IDs and behaviors

- **TASKS-B13 / A06:** AI breakdown generation/apply. No task capability is registered; the unavailable endpoint implements A07.
- **TASKS-B14 / A08:** contextual graph and meeting actions; future committee, initiative, note and meeting fields in B01/B05/I06. People assignment links exist, but are not a complete generic Context tab.
- **B03 / A02:** exact local-midnight timer/browser clock acceptance. Active task lists poll every 30 seconds, receiving server-computed bands and counts.
- **B08:** drag-and-drop reorder, swipe gestures, task-specific `c/d/p` shortcuts, make-subtask selector. Accessible up/down buttons, conversion, and the make-subtask API exist.
- **I05 / B12:** top-level reorder is not exposed; the current reorder endpoint supports a complete set of active siblings under a parent and requires every child's revision. Grouping retains the documented `childIds` payload with transaction-locked eligibility checks, rather than adding undocumented child revision requirements.
- **B11:** scheduled retention purge awaits the foundation's unfinished pruning integration.
- **UI polish:** telemetry/chart dashboard from the legacy document, markdown description preview, optimistic row animation, and saved-indicator timeout remain absent.
- Full feature coverage, mutation testing, API contract generation, query-budget/performance audits, and every failure/transition combination are not claimed. The runtime audit programs missing from WI-0001 remain missing.

## Files changed

- `src/modules/tasks`: new schemas, repository, services, API and bilingual screens, plus scenario tests.
- `src/core/time/tasks.ts`: timezone-aware calendar helpers and the pure `bandOf` function.
- `src/ui/entity`: split controls/list/detail/controller responsibilities; URL facets/selection; separate row actions; recoverable save queue. New Tasks/framework files pass their static checks.
- `src/ui/layout/nav.ts`, `AppShell.tsx`: Tasks entry; navigation labels are typed from the shared catalog instead of a second hard-coded three-page allowlist.
- `src/modules/home`, `src/modules/people/ui/PersonDetail.tsx`: task summaries and assignment links via public module surfaces.
- `src/core/i18n/messages`: matched en/ar task messages; shared labels made entity-neutral (the original “Create person” and “Search people” strings were unsuitable for a generic framework).
- `e2e`, `tests/fixtures/tasks`, `tools/capture-tasks.mjs`, `docs/screenshots/tasks-*`: browser verification and isolated fictional screenshot data.
- `vitest.config.ts`: integration files execute sequentially because they share the explicitly configured test database; concurrent operations within scenarios are still tested.

## Migrations

- `drizzle/0002_tasks.sql`: generated Tasks table, actor/owner/parent FKs and indexes, normalized generated search column, enum/title/completion/self checks.
- `drizzle/0003_task-invariants.sql`: depth trigger and deferred active-sibling order uniqueness using `btree_gist` equality exclusion.
- Both applied to the existing preview database and isolated test database. Migration-lock regression now expects four migration records. Existing table data was not reset. No accepted ADR was modified.
- Custom constraint/trigger introspection and a new empty-database release rehearsal remain part of the unfinished schema audit, not asserted here.

## Audits and verification

- TypeScript: **pass**.
- Dependency graph: **pass**, 245 modules / 751 dependencies.
- Tasks, `core/time`, entity framework, and nav targeted ESLint: **pass**.
- Vitest: **54 tests / 8 files pass**, including PostgreSQL integration and inherited core adversarial scenarios.
- Playwright: **14 scenarios pass**, covering People regressions, admin/backup regressions, task creation/edit/completion/restore in both locales, grouping, conflicts, idempotency, child reorder/restore, and Home/People links.
- Screenshot/axe matrix: **12 screens**, list/detail/create × en/ar × 1440×900/390×844; no horizontal overflow, browser errors, serious or critical axe violations. Fictional screenshot records are soft-deleted afterward; unrelated user records are untouched.
- Production Docker build succeeds. App starts with migrations and remains a single Node process plus PostgreSQL. Existing instrumentation/backup bundler warnings remain from WI-0001.

Required `pnpm audit:all` result:

```text
> pnpm lint && pnpm typecheck && pnpm depcruise && ...
> eslint . --max-warnings=0
core/db/jobs-repo.ts: claim/transaction callback exceed 60 lines (2 errors)
core/jobs/runner.ts: startRunner exceeds 60 lines
modules/people/ui/PersonForm.tsx: function size
modules/users/ui/AdminDataPage.tsx: function size and complexity (2 errors)
modules/users/ui/UsersPage.tsx: function size
ui/layout/AppShell.tsx: function size; existing location.assign warning
ui/layout/AuthForm.tsx: function size and complexity (2 errors)
11 problems (10 errors, 1 warning)
ELIFECYCLE exit 1
```

These are remaining foundation findings, not suppressed rules. The chain stops at lint; later audit stages are not reported as passing. The task work reduced the prior 15 lint errors to 10 by splitting the entity framework. The wider open-source release is not certified by the passing task scenarios.

## Commands for this workspace

From the ExecutiveOS repository:

```bash
# Run/update, retaining existing volumes and users
docker compose up -d --build
docker compose ps

# Unit/integration tests (the existing .env.test points to executiveos_test)
docker exec executiveos-wi0001-tooling node --env-file=.env.test node_modules/vitest/vitest.mjs run

# Browser tests (local preview credentials remain in ignored tmp/preview-access.json)
docker exec executiveos-wi0001-tooling pnpm exec playwright test --config tools/playwright-docker.config.ts

# Required full audit; known failure documented above
docker exec executiveos-wi0001-tooling pnpm audit:all

# Recapture isolated fictional examples and run axe
docker exec executiveos-wi0001-tooling node tools/capture-tasks.mjs
```

The tooling container and ignored `.env.test` were prepared in WI-0001; these commands describe this workspace, not an unattended fresh-clone test harness. Tests refuse a database whose name does not end in `_test`. Do not substitute the application database for it.

Sign in at **http://localhost:3000/login** with the existing account; local preview credentials are in ignored `tmp/PREVIEW-LOGIN.md`. Open **http://localhost:3000/tasks?view=all**. Screenshots are `docs/screenshots/tasks-{list|detail|create}-{en|ar}-{desktop|mobile}.png`; the capture script writes detailed accessibility results to ignored `tmp/tasks-accessibility.json`.

## Assumptions and resolutions

1. `docs/10-agent-workflow.md` § Implementer procedure: branch from the existing preview work rather than documentation-only main, preserving the requested running app. Work remains on `feat/tasks-management`; no remote/push/PR.
2. `docs/features/tasks.md` § B01/B05/B14 and `docs/03-data-model.md` § tasks: omit future-module columns until their referenced tables exist. Do not create fake modules, unconstrained UUID links, or a second owner identity table.
3. `docs/features/tasks.md` § I05 / `docs/03-data-model.md` § tasks: PostgreSQL does not support a deferred partial UNIQUE index. Use an equivalent deferred partial exclusion constraint with equality operators and a valid zero UUID. This preserves the invariant and atomic reorder. [PostgreSQL 16 CREATE TABLE](https://www.postgresql.org/docs/16/sql-createtable.html).
4. `docs/features/tasks.md` § B04 versus Mission Control § Filter Sidebar: include its dedicated Overdue view, while retaining ExecutiveOS Today = overdue + due today and ExecutiveOS status vocabulary. Older Mission Control “Deleted status” and reopen-to-Inbox behavior are superseded by ExecutiveOS soft deletion and reopen-to-next-action.
5. `docs/features/tasks.md` § B08/B11 / Mission Control § Trash: independently deleted children are shown under an active parent's Trash disclosure; restore appends to current sibling order to avoid positions reused by reordering. This preserves deletion provenance and the relative order of a restored group.
6. `docs/features/tasks.md` § B12 and API reorder table: add `revisions` keyed by child UUID to fence every affected row. Reject incomplete sibling sets instead of silently reordering a subset.
7. `docs/features/entity-pages.md` generic framework behavior: add optional facet/group/row-action/bulk slots and make common messages entity-neutral. Task completion and bulk selection are sibling controls, avoiding nested interactive elements.
8. `docs/07-coding-guidelines.md` § Data access: API transactions supply the transaction handle to task services, matching the existing wrapper. Hierarchy mutations share an advisory lock to serialize parent/child operations. Higher-throughput locking/performance work remains unbenchmarked.

## Documents changed

- `docs/features/tasks.md`: partial implementation status, legacy Overdue view, precise physical uniqueness terminology, current slice/deferred boundaries, restore-order behavior and reorder revision payload.
- `docs/03-data-model.md`: corrected invalid UUID/deferrable partial-index wording without changing the intended uniqueness invariant.
- `README.md`: running task preview link and update command.
- `HANDOFF.md`: link to this subsequent work; previous incomplete WI-0001 status retained.
- `docs/screenshots/tasks-*`: 12 new task screenshots with fictional data.

## Open questions / out of scope noticed

No further approval is required to use the delivered manual workflow. The maintainer still needs to prioritize the deferred Tasks interactions/integrations and unfinished Phase 1 audits; existing auth/jobs/backup limitations remain in `HANDOFF.md`. This task did not modify accepted ADRs or implement those unrelated foundation gaps.
