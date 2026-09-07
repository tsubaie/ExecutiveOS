## Hand-off: WI-0001 — Phase 1 skeleton and UI skeleton, with a People preview slice
Status: incomplete — a runnable Docker preview is delivered; the full WI-0001 acceptance gate is not met.

### Summary
The application is running locally at http://localhost:3000 with PostgreSQL persistence, an initialized preview administrator, and six invented People records plus the principal created during setup. The production-shaped image builds, runs as a non-root user, applies generated/custom migrations at startup, and exposes only the app on loopback; PostgreSQL has no published port. English and Arabic screens include setup, login, Home, users, settings, AI connection/disclosure, backups, jobs, audit, and the People list/detail/create forms. The People slice supports confirmed duplicate names, inline edits with revisions, soft delete, restore, and local query invalidation. The aggregate audit fails, and several mandatory Phase 1/framework behaviors remain incomplete; neither Phase 1 nor the entity framework is declared complete or frozen.

The owner's subsequent instructions to continue and run the application were treated as authorization to proceed with the conservative, concrete schema proposals previously recorded in this file. No further approval was requested merely for implementing already-authorized auth, jobs, settings, files, or backup infrastructure.

### Requirement → scenario
An ID marked **partial** below is not a claim to satisfy its complete specification. Named scenarios prove the listed subset only. Implemented behavior without a complete scenario is called out rather than assigned a passing placeholder test.

| ID / requirement | Test file | Scenario / proven scope |
|---|---|---|
| ADMIN-B01 | src/core/db/tests/adversarial.test.ts | `ADMIN-B01 setup race allows exactly one administrator; ADMIN-B04 protects last active admin` — real concurrent setup transactions. |
| ADMIN-A01 — partial locale coverage | e2e/preview.spec.ts; local setup browser drill | `ADMIN-A01 setup cannot run a second time; origin guard and private session boundary`; actual fresh English setup with printed token reached authenticated Home. A separate fresh Arabic setup drill remains outstanding. |
| ADMIN-B04 | src/core/db/tests/adversarial.test.ts; e2e/preview.spec.ts | Last-admin demotion rejected by service, deactivation rejected from UI. |
| ADMIN-A02 — partial | Same last-admin scenarios | Refusal is verified; adding a second administrator and then allowing deactivation needs its own scenario. |
| ADMIN-B12 — partial | e2e/preview.spec.ts | `ADMIN-B12 backup created from the admin page completes as a fenced job` — browser enqueue, in-process execution, resulting manifest appears. |
| ADMIN-B13 / ADMIN-A03 — partial | Manual isolated restore drill | `pnpm backup:restore /restore-input --confirm` completed into a separate database; restored 1 user, 9 People at the backup snapshot, and 2 migration records. No document upload or write-during-backup consistency scenario is claimed. |
| PEOPLE-I01, PEOPLE-B01 | src/modules/people/tests/schema.test.ts; src/core/db/tests/adversarial.test.ts; e2e/preview.spec.ts | Required name, tag deduplication, assignable create, and no insertion before homonym confirmation. |
| PEOPLE-I02 / I03 / I04 — implementation present, coverage incomplete | service.ts / schema/db.ts | Unique member FK, admin check for changing member links, assignability flag, principal delete protection. Dedicated adversarial scenarios for these three invariants remain required. |
| PEOPLE-B02 — partial | schema.test.ts; e2e/preview.spec.ts | Name normalization helper, visible rows, All/Trash navigation. Cursor/facet/count/search SQL scenarios are not complete; task/meeting statistics are absent by scope. |
| PEOPLE-B03 — partial | e2e/preview.spec.ts | Contact/notes editor and persisted organization edit; graph, Tasks, Meetings tabs deferred. |
| PEOPLE-B06 — partial | e2e/preview.spec.ts; adversarial.test.ts | Own People query invalidation and concurrent revision conflict; no graph/merge dependencies exist yet. |
| PEOPLE-A01 — partial, full criterion deferred | e2e/preview.spec.ts | Assignable toggle can be selected during creation; Tasks is deliberately absent. |
| PEOPLE-A05 | e2e/preview.spec.ts | Duplicate confirmation dialog in English and Arabic, with no duplicate created before confirmation; affirmative service path exists but needs a browser confirmation-success assertion. |
| PEOPLE-A06 | src/modules/people/tests/schema.test.ts | `PEOPLE-A06 Arabic initials use the first letters of two words`. |
| EP-B01 | src/ui/entity/tests/url-state.test.ts; e2e/preview.spec.ts | Create/detail precedence, view clearing, create URL. Multi-selection is deferred. |
| EP-B04 — partial | url-state.test.ts | Missing ID remains until close; full missing/deleted API plus rendered-state scenario remains. |
| EP-B05 — partial | e2e/preview.spec.ts | Current-user deletion closes detail. Other-user disappearance and next-row focus need scenarios. |
| EP-B08 / B09 — partial | e2e/preview.spec.ts | Full-width mobile detail and direction/overflow checks in both locales at 390 px. Rail uses a dialog rather than the required touch bottom sheet. |
| EP-B02 / B03 / B06 / B07 / B10 / B11 / B13 / B15 / B16 / B17 / B18 — partial, not fully proven | src/ui/entity/* | URL navigation, keyboard subset, fixed desktop rail/detail, serial saves, some navigation waits, paging button, empty/error states, title focus and query refresh exist. The missing pieces are listed below. |
| HOME-B02 / HOME-A03 | e2e/preview.spec.ts | `HOME-B02 HOME-A03 disabled sections collapse and AI review section is absent`. |
| HOME-B03 / B04 / B05 — implementation present, coverage incomplete | modules/home | Single aggregated endpoint, query refresh, user/principal greeting. Query-count and alternate-principal scenarios remain. |
| Core revision conflict | src/core/db/tests/adversarial.test.ts | Two concurrent updates: exactly one succeeds. |
| Core job lease expiry / late writer | Same | `job lease expiry fences a late writer and rolls back its side effects` — expired lease reclaimed, first publication rejected, second result stored, two attempt records. The test verifies fenced publication; it does not yet inject an additional side-effect write into the rejected transaction. |
| Core active deduplication | Same | `active dedup key returns the existing job under concurrent insert`. |
| Core scheduler occurrence | Same | `scheduler occurrence is not repeated after its job becomes terminal`. |
| Core migration lock | Same | `migration lock serializes concurrent migrators without schema drift`. |
| Core idempotency replay | e2e/preview.spec.ts | `idempotency replay returns one entity; changed payload with the same key conflicts` — same JSON body and entity, 201/201/409. JSON object member order is not treated as meaningful. |
| Static-rule / graph fixtures | scripts/audit/tests/*.test.mjs | Existing 28 executable tooling scenarios pass. This is not complete per-audit fixture coverage. |

### Deferred and incomplete work
These gaps prevent acceptance of WI-0001. The additional code is a working preview checkpoint, not a substitute for the milestone requirements.

- **Milestone 1:** all named audit commands remain wired, but the runtime programs under `scripts/audit/` and their individual violating fixtures are still missing. Existing static rules run and currently reject the new source for function limits/complexity and delegated keyboard handling. The framework and several forms need responsibility-based refactoring; no lint rule was disabled to declare success.
- **Milestone 2:** session management/password/profile routes; proxy-aware per-IP rate limits (currently a conservative shared IP bucket); complete OpenAPI generation; complete schema reflection audit/FKs/custom-column representation; upload quota/streaming/signature enforcement; connected orphan/prune scheduling; backup retention/download/delete/verify actions; restore admission against concurrent writes and maintenance gating for server-rendered pages; runner drain timeout, exhausted expired-lease handling and complete cancellation/deadline scenarios; model allowlist/feature matrix and full provider contract remain incomplete. No AI capabilities are registered. Only system.noop, system.prune, system.backup are in the job registry. No default schedule rows have been seeded yet.
- **Milestone 3:** persistent per-user theme/numerals/timezone, complete catalog error localization, toast primitive, markdown renderer, chart wrappers, PWA, pointer-driven sheets and 320 px/focus-ring coverage remain incomplete. Base UI primitives were generated from shadcn's base-nova registry and adapted to semantic tokens, logical directions, Lucide and localized Close labels.
- **Milestone 4:** EP-B02–B07 and B10–B18 need their specified complete scenarios. EP-B10 lacks reload/diff/reapply and the saved-to-idle timer; EP-B11 does not guard every filter/back/browser navigation; EP-B12 optimistic rollback is absent; EP-B13 uses Load more, and crossing the loaded boundary requires another next click; EP-B14 grouping is absent. Multi-selection/bulk operations are absent. EP-A01, A02, A05 are deferred for Tasks/Notes. EP-A03, A04, A06 need full keyboard/conflict/position scenarios, beyond current People browser coverage.
- **Milestone 5:** ADMIN-B02 recovery code exists but ADMIN-A06 replay/restart proof remains. ADMIN-B03 has list/create/edit/activation and temporary password display, but not the full reset/sessions workflow. ADMIN-B05/B06 profile and member linking UI are absent. ADMIN-B07 registry editing exists as text/JSON controls, not all schema-driven controls. ADMIN-B08/B09 notes/KPI editors and ADMIN-A05 await those modules. ADMIN-B10 is the scoped connection/disclosure preview; models and capability controls are not implemented. ADMIN-B11 learnings and ADMIN-B14/ADMIN-A04 export are deferred per work-item scope. ADMIN-B12/B13 and ADMIN-A03 are partial as above. ADMIN-B15 exposes job listing but not attempts/retry/cancel UI. ADMIN-B16 shows audit entries/diffs but lacks filters. HOME-B01/A01 populated-module sections await excluded modules; HOME-A02 query counting remains.
- **Milestone 6:** PEOPLE-B04/B05, PEOPLE-A02/A03/A04, and the Tasks-dependent portion of PEOPLE-A01 are deferred. PEOPLE-I05 has no graph/attendee cascade because those tables are not in the preview; provenance on the person is implemented. PEOPLE-B02 has no task/meeting sort/stats or graph filters; facets accepted by the API are not yet exposed in the UI.
- **Milestone 7:** the core SIGKILL/restart, upload orphan crash, write-during-backup, complete restore drill with documents, session revocation matrix, boundary/API matrix, required per-module test files, coverage/mutation gates, and audit self-tests remain required. Seven live browser scenarios and forty unit/PostgreSQL/guardrail tests pass, but this is not the complete required suite.
- **Milestone 8:** 44 screenshots captured for the specified routes/locales/viewports; final contrast/overflow findings are recorded below. They show the current preview, not complete feature acceptance.

### Files changed
The checkpoint spans more than 800 lines because it introduces the initial runtime, generated Drizzle snapshots, and all preview routes from an empty application tree. Commits are separated into core, UI foundation, entity framework, connected screens, and verification artifacts. They are explicitly WIP commits because milestone acceptance is incomplete.

- Core: config, DB client/migrator/schema and repositories, auth, HTTP wrapper/client/errors/origin/idempotency/pagination, job registry/runner/scheduler, files, backup/restore/manifest, AI connection/fake interface, i18n.
- Modules: People persistence/services/API/UI; users setup/admin surfaces; settings registry editing; Home aggregation.
- UI and routes: semantic tokens, generated Base UI primitives, shell/navigation/preferences, entity framework, auth/Home/admin/People routes and loading/error boundaries.
- Tooling: generated/custom migrations, Docker runtime fixture copy, migration/seed/backup commands, browser scenarios, screenshot capture tool and Docker Playwright configuration.
- Documentation: root README.md, SECURITY.md, HANDOFF.md and new PNG files under docs/screenshots. No existing document under docs/ was edited; no accepted ADR was edited.

### Migrations
- `drizzle/0000_system-and-people.sql`: generated system tables, recovery-token history and People.
- `drizzle/0001_normalization-and-system-checks.sql`: reviewed custom normalization function, generated People search column/trigram index, system CHECK constraints.
- Both apply to an empty PostgreSQL 16 database and survive concurrent migrators. The preview and isolated tests have both applied them. Do not edit these migrations after this checkpoint is committed.
- The migration folder includes drizzle-kit metadata. Custom search/check definitions still require full schema-audit reconciliation before acceptance.

### Audits
- `docker compose build app`: passed, including Next production build and TypeScript checking. The build emits Node API/Edge instrumentation and dynamic backup path tracing warnings; deployment is Node-only, but bundler isolation still needs attention.
- `docker compose up -d`: healthy app + healthy PostgreSQL; migrations and setup-token logging verified from an empty application database.
- `pnpm typecheck`: passed on final source.
- `pnpm depcruise`: passed, 204 modules and 583 dependencies at the pre-format check.
- Vitest against the isolated PostgreSQL database: 5 files, 40 tests passed.
- Live Playwright: 7 scenarios passed; see e2e/preview.spec.ts.
- Backup create and separate-database restore: passed for current database with an empty document volume. This is not the required concurrent-document consistency proof.
- `pnpm audit:all`: FAILED at lint, 15 errors and 1 warning after formatting. Later gates did not run. The missing audit programs would also fail once lint is repaired. Exact output follows at the end of this file.

### Manual verification
Final screenshot/axe run: 44 PNGs, 36 route/locale/viewport checks, zero serious or critical axe findings, and no horizontal overflow at the captured widths. This does not replace the remaining 320 px/focus, keyboard, and interaction-specific accessibility tests.

English and Arabic: login, Home, People list/create/detail/edit/trash/restore at desktop and 390 px verified by Playwright. Local fresh setup was performed using an invented administrator and generated credentials, which are stored only in ignored `tmp/preview-access.json` and `tmp/PREVIEW-LOGIN.md`. The account is not seeded into new installations; new installations still require setup. Screenshots use 1440×900 and 390×844, dark by default, with additional light captures for Home and People list.

### Maintainer commands
From the repository root, start or rebuild the app:

```bash
docker compose up -d --build
docker compose logs app
```

Open http://localhost:3000. On a fresh database, use the printed SETUP_TOKEN, create your own administrator, then log in with that account. For this already-running local preview, the generated login details are in the ignored `tmp/PREVIEW-LOGIN.md` file. Load the repeat-safe six-person development seed after setup:

```bash
docker compose exec app pnpm db:seed
```

Reproduce checks in the existing Node 22 tooling container used in this workspace (it mounts this checkout and is connected to the Compose network):

```bash
docker start executiveos-wi0001-tooling
docker exec executiveos-wi0001-tooling pnpm typecheck
docker exec executiveos-wi0001-tooling node --env-file=.env.test node_modules/vitest/vitest.mjs run
docker exec executiveos-wi0001-tooling pnpm exec playwright test --config tools/playwright-docker.config.ts
docker exec executiveos-wi0001-tooling pnpm audit:all
docker exec executiveos-wi0001-tooling node tools/capture-preview.mjs
```

`.env.test` is ignored and contains DATABASE_URL_TEST for a separate database named `executiveos_test`; the suite refuses a DB whose name does not end in `_test`. Never substitute the preview/production database. These exact commands reproduce this local environment; portable automatic creation of test DB/browser credentials/tooling remains outstanding. The browser suite expects the ignored local preview credentials fixture; it does not silently create a production account.

View PNG files under `docs/screenshots/`. Unsuffixed files are dark; `-light.png` files are the two additional light-theme routes. Create/restore commands in the app image:

```bash
docker compose exec app pnpm backup:create
docker compose exec app pnpm backup:restore /var/lib/executiveos/backups/BACKUP_ID --confirm
```

The latter replaces the target database. The performed drill used a separate `executiveos_restore_test` database and copied backup input, not the running preview's database. Existing unrelated containers and their data were not modified. ExecutiveOS's app and database are left running. No remote was created, and nothing was pushed.

### Assumptions and proposed spec resolutions
1. **Physical settings key** — docs/03-data-model.md:47–48: PostgreSQL does not allow an expression PRIMARY KEY. Implemented the same logical uniqueness as an expression UNIQUE index plus a workspace/user ownership CHECK, without adding a surrogate id. Proposed edit: describe this physical constraint explicitly.
2. **Token persistence** — docs/03-data-model.md:36 and features/admin.md:14–15: added nullable workspace.setup_token_hash and recovery_token_uses(token_hash, used_at). Only hashes persist; an unused setup token is rotated/printed on an uninitialized boot. Proposed edit: add these storage fields to the system inventory. These were new, empty tables, not a change to existing user data.
3. **Restore response** — docs/04-api-conventions.md, Response envelopes versus Resources and verbs: implemented 200 with the restored entity, as the verbs table and entity framework require; delete remains 204 with X-Op-Id. Proposed edit: remove restores from the 204 exception line.
4. **Framework API shape** — features/entity-pages.md:12–37 versus docs/07 component prop cap: grouped render callbacks under `renderers`, staying under twelve top-level props. Item and detail currently share one generic entity type; the full public generic API is not claimed complete.
5. **Partial People scope** — features/people.md: Behaviors and WI-0001: omitted graph/task/meeting data and controls rather than fabricating statistics. Kind/name/contact/assignability remain real persisted fields.
6. **Preview Home** — features/home.md:23 and WI-0001's visible People slice: disabled future modules collapse to single lines, AI reviews are absent, and a directory entry links to the only implemented domain module. This extra directory entry is a preview assumption for review, not a new Home acceptance criterion.
7. **Seed ordering** — docs/03-data-model.md:198 and ADMIN-B01: preview seeding runs after secure setup, uses that administrator as actor, and adds six invented people. Production boot does not create a built-in administrator/password. `--large` and later-module seed data are deferred.
8. **Docker client binaries** — ADR 0008: runtime uses the official PostgreSQL 16 image for its bundled v16 client installation and copies Node 22 into it. Only Node runs as the app process; a second PostgreSQL server is not started in that container.
9. **Disabled AI** — WI-0001 versus docs/06's full registry: no capabilities or workspace-content calls. Connection testing alone uses the SDK's models API when an operator supplies a key.
10. **Test-only resources** — docs/08 Core adversarial suite: created isolated executiveos_test and executiveos_restore_test databases on the new ExecutiveOS DB service. No predecessor or unrelated application database was used.

### Open questions
No new permission is needed to finish the already-authorized work. The schema/API assumptions above need maintainer review before merging; outstanding implementation and audit failures are work to finish, not approvals to infer from silence.

### Out of scope, noticed
- The accepted AI specification includes exact future model strings and feature assumptions. This preview does not exercise them and makes no provider-capability claim.
- docs/03's schedule inventory includes file job kinds outside WI-0001's explicit three-kind restriction. A complete implementation should run file maintenance within the authorized prune workflow or obtain a revised work item, rather than register extra kinds silently.
- The development image still needs matching PostgreSQL clients and a clean-volume dev startup drill; only the production-shaped image was built and run.
- Security reporting configuration is deliberately explicit as incomplete in SECURITY.md; this checkout has no public remote/contact to invent.

### Exact aggregate audit output

```text

> executiveos@0.1.0 audit:all /workspace
> pnpm lint && pnpm typecheck && pnpm depcruise && pnpm audit:structure && pnpm audit:i18n && pnpm audit:portability && pnpm audit:docs && pnpm audit:schema && pnpm audit:tests && pnpm audit:deps && pnpm audit:secrets && pnpm test && pnpm build && pnpm audit:bundle && pnpm test:e2e && pnpm audit:openapi && pnpm audit:a11y && pnpm audit:perf && pnpm audit:dupes


> executiveos@0.1.0 lint /workspace
> eslint . --max-warnings=0


/workspace/src/core/db/jobs-repo.ts
  42:8   error  Async function 'claim' has too many lines (71). Maximum allowed is 60  max-lines-per-function
  43:27  error  Async arrow function has too many lines (69). Maximum allowed is 60    max-lines-per-function

/workspace/src/core/jobs/runner.ts
  9:8  error  Function 'startRunner' has too many lines (61). Maximum allowed is 60  max-lines-per-function

/workspace/src/modules/people/ui/PersonForm.tsx
  29:8  error  Function 'PersonForm' has too many lines (99). Maximum allowed is 60  max-lines-per-function

/workspace/src/modules/users/ui/AdminDataPage.tsx
  21:8  error  Function 'AdminDataPage' has too many lines (93). Maximum allowed is 60  max-lines-per-function
  21:8  error  Function 'AdminDataPage' has a complexity of 15. Maximum allowed is 12   complexity

/workspace/src/modules/users/ui/UsersPage.tsx
  92:8  error  Function 'UsersPage' has too many lines (61). Maximum allowed is 60  max-lines-per-function

/workspace/src/ui/entity/EntityPage.tsx
  16:8  error  Function 'EntityPage' has too many lines (223). Maximum allowed is 60  max-lines-per-function
  16:8  error  Function 'EntityPage' has a complexity of 20. Maximum allowed is 12    complexity
  98:5  error  Components must use query hooks and accessible, stable-key controls    eos/component-safety

/workspace/src/ui/entity/EntityPanel.tsx
  24:8  error  Function 'EntityPanel' has too many lines (130). Maximum allowed is 60  max-lines-per-function

/workspace/src/ui/entity/use-save-queue.ts
  5:8  error  Function 'useSaveQueue' has too many lines (68). Maximum allowed is 60  max-lines-per-function

/workspace/src/ui/layout/AppShell.tsx
  15:8  error    Function 'AppShell' has too many lines (80). Maximum allowed is 60                                                                                                                                                                                               max-lines-per-function
  32:7  warning  Do not use `location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination  @next/next/no-location-assign-relative-destination

/workspace/src/ui/layout/AuthForm.tsx
  29:8  error  Function 'AuthForm' has too many lines (127). Maximum allowed is 60  max-lines-per-function
  29:8  error  Function 'AuthForm' has a complexity of 15. Maximum allowed is 12    complexity

✖ 16 problems (15 errors, 1 warning)

 ELIFECYCLE  Command failed with exit code 1.
 ELIFECYCLE  Command failed with exit code 1.

```

## Subsequent work

Tasks management was added on `feat/tasks-management`. See [TASKS-HANDOFF.md](TASKS-HANDOFF.md) for its scope and verification. This does not mark the remaining WI-0001 foundation requirements complete.
