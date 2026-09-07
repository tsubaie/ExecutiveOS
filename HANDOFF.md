## Hand-off: WI-0001 — Phase 1 skeleton and UI skeleton, with a People preview slice
Status: blocked — the first migration needs the schema resolutions below. The application and UI are not runnable.

### Plan
1. Read the specification in the requested order and verify Docker/Node 22 tooling.
2. Bootstrap documentation on main, then work on feat/phase-1-skeleton only.
3. Scaffold tooling, static rules with violating fixtures, and Docker configuration.
4. Resolve the first-migration schema blockers described below.
5. Complete the runtime audits, persistence, auth, jobs, storage, backup, HTTP, and AI infrastructure.
6. Build localized primitives, shell, and entity framework with scenario coverage.
7. Build auth, Home, scoped administration, and the People preview.
8. Run real-PostgreSQL adversarial tests, browser tests, and the Docker restore drill.
9. Capture screenshots and complete the final requirement-to-scenario matrix.

### Summary
The required documents were read in order, including the requested feature specs, ADRs, and templates. Docker works; tooling runs in Node 22 because the host has Node 26 and no pnpm. Existing documentation was committed once on main as authorized; the tooling checkpoint is on feat/phase-1-skeleton with no remote. There are 28 passing tooling scenarios, but no product behavior ID is implemented end to end. While drafting the first system schema, a real PostgreSQL 16 probe rejected the settings primary key specified in docs/03, and setup/recovery persistence required schema not listed there. The proposed core files are unapplied drafts, not a completed migration or runtime.

### Milestone status
| Milestone | Status and remaining work |
|---|---|
| 1 — Tooling | Scaffold committed. Exact dependency versions, scripts, compiler, ESLint/custom rules, dependency graph, formatter, Vitest, Playwright, Dockerfile, Compose files, env example, and README section exist. Full static-rule coverage and all audit programs/fixtures still need completion; image builds have not been verified. This is not a claim that every Milestone 1 requirement is complete. |
| 2 — Core | Blocked at the system-schema draft. Config validation and UUID helper drafted; no migration generated/applied, no runtime behavior or adversarial suite implemented. |
| 3 — UI foundation | Not started. |
| 4 — Entity framework | Not started. |
| 5 — Auth/Home/Admin pages | Not started. |
| 6 — People | Not started. |
| 7 — Verification | Tooling checks and Compose syntax only; audit:all fails as recorded below. No app build, browser tests, or restore drill. |
| 8 — Screenshots | Not started; no screenshots exist. |

### Requirement → scenario
No ADMIN, HOME, EP, or PEOPLE behavior/acceptance ID is claimed implemented. The names below refer to WI-0001 Milestone 1 tooling checks, not invented product requirement IDs.

| Work-item requirement | Test file | Scenario name / proof |
|---|---|---|
| WI-0001-M1 custom static guardrails | scripts/audit/tests/static-rules.test.mjs | `WI-0001-M1 static guardrails reject violating fixtures` — 23 parameterized violating cases from fixtures/static-invalid.json plus four valid-boundary scenarios; 27 passing tests. |
| WI-0001-M1 graph boundaries through re-exports | scripts/audit/tests/dependency-graph.test.mjs | `WI-0001-M1 dependency boundary fixtures > rejects a UI-to-server dependency hidden behind a barrel`; 1 passing test. |

These tests exercise the rule implementations and dependency-cruiser API. They do not establish complete enforcement of every static rule or provide the still-missing per-audit violating fixtures.

### Deferred and unimplemented spec IDs
All the following are unimplemented at this blocked checkpoint, rather than marked passed by placeholders:

| IDs | Reason / intended scope after resumption |
|---|---|
| PEOPLE-I01–I05; PEOPLE-B01–B06; PEOPLE-A01–A06 | No People implementation yet. The intended preview covers create/list/detail/edit/delete/restore and local invalidation; graph statistics, merge/unmerge, Tasks, and Meetings dependencies remain deferred by WI-0001. PEOPLE-A01 can only be partial (assignability) until Tasks exists; do not claim the complete criterion. PEOPLE-A02–A04 depend on excluded meeting/task/merge work. PEOPLE-A05 and A06 are intended complete preview criteria. |
| EP-B01–B18; EP-A01–A06 | Framework not started. Actual Tasks/Notes criteria EP-A01, EP-A02, EP-A05 must remain deferred; equivalent People navigation tests cannot be mislabeled as those complete criteria. Generic behaviors and EP-A03/A04/A06 are intended for this work item where independently exercisable. |
| ADMIN-B01–B16; ADMIN-A01–A06 | Admin not started. ADMIN-B10 is limited by WI-0001 to connection status/check and disclosure, with no model capabilities; export ADMIN-B14/A04 may be deferred. Learnings ADMIN-B11 and KPI preview ADMIN-B09/A05 depend on excluded modules. Other Phase 1 administration remains required after the schema decision. |
| HOME-B01–B05; HOME-A01–A03 | Home not started. Full populated-module HOME-B01/A01 waits for those modules; disabled/empty collapse, greeting, refresh, aggregation, and disabled-AI absence are intended for this work item. |
| Core adversarial scenarios in docs/08 | None implemented. Revision race, lease expiry/late writer, runner kill/restart, deduplication, scheduler occurrence, idempotency replay, setup race, last-admin protection, migration lock, upload-orphan recovery, and backup consistency/restore remain required. |

### Files changed
- Root tooling: package.json and lockfile; TypeScript, Next, ESLint, dependency-cruiser, Prettier, Vitest, Playwright, PostCSS, and knip configurations.
- Docker: Dockerfile, docker-compose.yml, docker-compose.dev.yml, .dockerignore, .env.example.
- Static rules: tools/eslint/*.mjs and client-files.cjs, with 28 tooling scenarios and violating fixtures under scripts/audit/tests.
- Core draft: src/core/config/defaults.ts, env.ts; src/core/db/ids.ts and system-schema.ts. These do not constitute a working core implementation.
- Documentation: root README.md replaces the target quick-start heading with Run with Docker and explicitly warns the branch is in progress; root HANDOFF.md records this checkpoint.
- No file under docs/ was changed. No accepted ADR, LICENSE, or NOTICE was changed.
- An ignored .env was created for this local development stack with generated credentials; it is not committed and its values were not printed.

### Migrations
None generated or applied. The temporary-table probe ran inside BEGIN/ROLLBACK against the newly created PostgreSQL 16 development service and left no application tables.

Unapplied proposals in src/core/db/system-schema.ts:
- `settings_scope_key`: expression UNIQUE index for the documented logical key, instead of an invalid expression PRIMARY KEY; a CHECK distinguishes workspace rows with null user_id from user rows with a non-null user_id.
- `workspace.setup_token_hash`: proposed nullable setup-token digest storage.
- `recovery_token_uses(token_hash PRIMARY KEY, used_at)`: proposed durable record preventing token reuse across restarts and token rotations. No raw recovery token is stored.

The rest of that schema is preliminary: enum CHECKs, standard-column FKs, People, schema audit integration, and generated/custom migrations are still outstanding. Do not treat it as the approved complete schema.

### Audits
Run in the Node 22.23.2 tooling container with pnpm 10.30.3:

| Command | Result |
|---|---|
| pnpm install | Passed after pinning compatible TypeScript/ESLint versions. |
| pnpm lint | Passed; Next emits a missing-pages diagnostic because no application routes exist yet. |
| pnpm typecheck | Passed for the files present. |
| pnpm depcruise | Passed on the current draft core graph: 9 modules, 9 dependencies. |
| pnpm test:audits | Passed: 2 files, 28 tests. |
| pnpm audit --audit-level high | Exit 0: no high/critical advisories; 4 moderate advisories remain. |
| docker compose config --quiet | Passed without printing resolved secrets. |
| docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet | Passed without printing resolved secrets. |
| pnpm audit:all | FAILED at the first missing runtime audit; output below. |

`pnpm audit:all` output summary (stack frames omitted; failure message preserved):

```text
> executiveos@0.1.0 audit:all
> pnpm lint && pnpm typecheck && pnpm depcruise && pnpm audit:structure && ...

> executiveos@0.1.0 lint
> eslint . --max-warnings=0
Pages directory cannot be found at /workspace/pages or /workspace/src/pages.

> executiveos@0.1.0 typecheck
> tsc --noEmit

> executiveos@0.1.0 depcruise
> depcruise src --config .dependency-cruiser.cjs
✔ no dependency violations found (9 modules, 9 dependencies cruised)

> executiveos@0.1.0 audit:structure
> tsx scripts/audit/structure.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/workspace/scripts/audit/structure.ts' imported from /workspace/
Node.js v22.23.2
ELIFECYCLE Command failed with exit code 1.
```

Later audit gates did not execute. The audit:* package scripts are command contracts; their runtime implementations have not been written. No assertion that all audit scripts exist or pass is made. The dependency install reports deprecated ESLint 9 and two Drizzle-kit transitive dependencies, plus ignored optional install scripts; these must be revisited during completed image/build validation. ESLint 9 was selected because the current Next React/accessibility/import lint plugins do not declare ESLint 10 support. TypeScript 5.9.3 was selected because typescript-eslint and dependency-cruiser do not support TypeScript 7.

### Manual verification
- en desktop: not performed; UI absent.
- ar desktop: not performed; UI absent.
- en 390px: not performed; UI absent.
- ar 390px: not performed; UI absent.
- Docker server and PostgreSQL 16 service startup: verified.
- App image, SETUP_TOKEN, setup/login, admin, People, screenshots, backup/restore: not implemented or verified.

### Maintainer commands and current limits
There is no functioning application login or screenshot gallery at this checkpoint. Running the app image now will fail because the required routes, i18n request module, and runtime are missing. README's completed-stack commands are labeled as intended workflow, not verified delivery.

From the repository root, reproduce the passing tooling scenarios without installing Node/pnpm on the host:

```bash
docker run --rm --mount type=bind,src="$PWD",dst=/workspace --workdir /workspace node:22-bookworm-slim sh -lc 'corepack enable && corepack prepare pnpm@10.30.3 --activate && pnpm install --frozen-lockfile && pnpm test:audits'
```

Validate Compose (requires a populated ignored .env):

```bash
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
docker compose up -d db
```

After implementation is resumed and completed, the intended commands remain:

```bash
docker compose up -d --build
docker compose logs app
# Read SETUP_TOKEN, open APP_URL, complete setup, then log in with the chosen credentials.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose exec app pnpm test
docker compose exec app pnpm test:e2e
docker compose exec app pnpm audit:all
docker compose exec app pnpm backup:restore /var/lib/executiveos/backups/BACKUP_ID --confirm
# Screenshots will be committed under docs/screenshots; none exist yet.
```

The temporary tooling container and PostgreSQL service are stopped at this checkpoint. Their local resources and the database volume are preserved; no unrelated container or volume was altered. The tooling container is named executiveos-wi0001-tooling and can be restarted with `docker start executiveos-wi0001-tooling` when resuming.

### Assumptions
1. WI-0001 explicitly authorizes the named dependencies and Phase 1 auth/settings/jobs/files/backup/AI implementation. This overrides the generic need to re-request authorization simply for touching those components in docs/10-agent-workflow.md:32–34. It does not authorize silently replacing an explicitly specified schema constraint.
2. The work item's explicit People, framework, export, and AI-page deferrals take precedence over full-module coverage requirements in docs/08-testing-strategy.md and docs/09-audit-checklists.md. Deferred IDs must be recorded, not assigned passing placeholder tests.
3. Development dependency commands are permitted; ADR 0008's restrictions apply to the delivered application runtime. The operator needs Docker only. The Node 22 tooling container fulfills the work item's pinned major-version requirement without modifying the host's Node installation (docs/02-architecture.md, Stack).
4. `.dependency-cruiser.cjs` is explicitly required by WI-0001 and docs/02-architecture.md, so CommonJS imports in .cjs tooling files are permitted despite docs/07's ESM convention. This exception is narrowly scoped in eslint.config.mjs, not an inline suppression.
5. The Docker runtime draft uses the official PostgreSQL 16 image for matching bundled v16 client binaries and copies Node 22 into it. It does not start a second database process in the app container. This is an implementation proposal satisfying ADR 0008's client-binary requirement, not a verified image yet.
6. Development/test defaults live in configuration and .env.example (docs/02 Configuration); local secrets are newly generated and ignored. No credentials from the predecessor or existing production systems were accessed.

### Open questions
1. **Settings physical key — blocking.** docs/03-data-model.md:48 requires `PRIMARY KEY (key, scope, coalesce(user_id, ...))`. PostgreSQL primary keys cannot contain expressions. A PostgreSQL 16 temporary-table probe returned SQLSTATE `42601`, `syntax error at or near "("`. Options: (A) preserve the documented logical key as an expression UNIQUE index and a scope/user CHECK, with no surrogate id; (B) add an id primary key and retain separate logical uniqueness. **Recommendation: A**, represented by the unapplied settings draft. Confirm the change to docs/03 before generating the migration.
2. **Setup/recovery persistence — blocking.** ADMIN-B01/B02 (docs/features/admin.md:14–15) require token verification and durable single-use recovery across restarts. docs/03's workspace/system tables provide no token hash/used-token storage. Options: (A) add `workspace.setup_token_hash` and `recovery_token_uses(token_hash, used_at)`, as in the draft; (B) specify an alternative durable store, including how it participates in backup/restore and prevents reuse after rotating through multiple tokens. **Recommendation: A**, with token consumption and password reset in one transaction. The draft has not been migrated or used.

Stopping follows docs/10-agent-workflow.md:33, which requires escalation when work would “contradict a spec section or an ADR, or require choosing between conflicting documents,” and line 38, which requires a `wip:` commit, a blocked hand-off, and stopping. The WI-0001 milestone instruction also requires a blocked hand-off when work cannot be completed as specified.

### Out of scope, noticed
- docs/04-api-conventions.md's envelope exceptions say restores return 204, while its Resources and verbs table says 200 with the entity. The entity framework also expects an entity; resolve the central convention when implementing routes. This did not cause the current schema stop.
- docs/07's component-prop limit is 12, while docs/features/entity-pages.md's public API shows 14 props. Before freezing the framework, group renderers/options or explicitly define the applicable exception; do not evade the lint rule through type aliases.
- Some Phase 1 administration requirements refer to excluded later modules (KPI preview and learnings). WI-0001's narrower page scope takes precedence; deferred IDs are identified above.
- The development Docker stage still needs matching bundled PostgreSQL client binaries for development backup drills, and runtime dependency/image-size validation remains outstanding. No image-build success is claimed.
- No production data was read, migrated, reset, or restored. No remote was created or push attempted.
