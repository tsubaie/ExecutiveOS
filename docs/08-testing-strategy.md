# 08 — Testing strategy

Tests exist to prove behavior. The unit of proof is a **scenario named by requirement ID**. A test that would pass after deleting the feature is not a test.

## Layers

| Layer | Tool | Runs against | Location |
|---|---|---|---|
| Schema | Vitest | Zod only | `modules/<m>/tests/schema.test.ts` |
| Service and repo | Vitest | real PostgreSQL (testcontainers or `DATABASE_URL_TEST`) | `modules/<m>/tests/service.test.ts`, `repo.test.ts` |
| Constraints | Vitest, raw SQL | real PostgreSQL | `modules/<m>/tests/constraints.test.ts` |
| API | Vitest calling route handlers with `Request` | real DB, seeded sessions | `modules/<m>/tests/api.test.ts` |
| Component | Vitest + Testing Library + MSW | mocked API | `modules/<m>/tests/ui/*.test.tsx` |
| AI | Vitest + `FakeProvider` | no network | `modules/<m>/tests/ai.test.ts` |
| Core adversarial | Vitest, two DB connections, child process for runner | real DB | `src/core/**/tests/` |
| End-to-end | Playwright | built app + seeded DB | `e2e/<m>.spec.ts` |
| Audit self-tests | Vitest | violating fixtures under `scripts/audit/tests/fixtures` | `scripts/audit/tests` |

Mocking the database is forbidden. Test databases are created from the migrations.

## Scenario naming

```ts
it("TASKS-B02 refuses completing a parent with open subtasks unless force", …)
it("TASKS-A04 restores parent and cascade-deleted subtasks only", …)
```

The docs audit cross-references IDs between specs and test names. A requirement without a test fails the audit; a test naming an unknown ID fails the audit.

## Required coverage per module

1. **Every behavior ID** in the spec has at least one scenario at the layer that owns it (service for rules, repo for list semantics, API for contracts, UI for interaction).
2. **Every invariant** has a scenario that attempts to violate it through the service and asserts the `AppError` code, plus a constraints scenario that attempts it with raw SQL and asserts the database rejects it (where a DB constraint exists).
3. **Every acceptance criterion** has an e2e scenario in `en` and `ar`.
4. **Every mutation** has an API scenario for: happy path, validation failure with dotted field paths, 401, 403 (admin routes and origin check), 404 for deleted ids, 409 on stale revision, idempotent replay, envelope shape.
5. **Every list** has repo scenarios for: each view equals its count under the same facets, sort tuples with nulls, cursor continuation with an insert between pages, cursor rejection on changed filters, `linkedTo`, search normalization (Arabic forms).
6. **Every AI capability** has: fixture happy path in `en` and `ar`, adversarial fixture, schema drift, refusal and invalid-output handling, request capture (what was sent, what was excluded), apply idempotency, stale-source 409, disabled-AI absence.
7. **Mutation tests for critical rules**: for each module, three rules listed in the spec's audit items are verified by temporarily inverting the implementation in CI (`pnpm test:mutate`, Stryker on the listed functions) and asserting the suite fails.

## Core adversarial suite (`src/core/**/tests`)

| Scenario | Method |
|---|---|
| Concurrent revision updates | two connections, one wins, other gets 409 |
| Job claimed twice after lease expiry, first handler finishes late | fencing rejects the late result; one `job_attempts` row per attempt |
| Runner killed mid-handler | spawn runner as child process, SIGKILL, restart; job reclaimed after lease; side effects not duplicated |
| Duplicate `dedup_key` insert | returns the existing job |
| Scheduler occurrence twice | second insert no-op |
| Duplicate `Idempotency-Key` | replay; different hash → 409 |
| Cross-user private notes | user B cannot read A's note via API, server component, job payload, audit log, or export |
| Setup race | two concurrent setup submissions, one succeeds |
| Last admin protection | deactivate or demote refused |
| Upload crash between file write and DB insert | orphan sweep removes the file; no dangling row |
| Backup consistency | writes during backup; restore verifies manifest and every referenced file exists |
| Restore drill | restore into empty DB, app boots, golden paths pass |
| Migration lock | two migrators, one applies |

## Test data and clocks

- Factories in `tests/factories/` create data through services with `ctx`. Constraint tests use raw SQL on purpose.
- Fresh transaction per test (`BEGIN … ROLLBACK`) or truncate helper. No order dependence.
- `vi.setSystemTime()` for anything date-related; boundaries tested at 23:59:59 in two timezones (`Asia/Riyadh`, `America/New_York`) from fixtures, and at quarter and year rollovers.
- Locale-sensitive scenarios run under `describe.each(["en", "ar"])`.

## Forbidden patterns

Reading source files in tests (except audit self-tests) · re-implementing logic under test · whole-component snapshots (small structural snapshots of RTL SVG or `dir` attributes are allowed) · mocking `repo` in service tests or `service` in API tests · `test.skip`/`todo` on main without an issue link · sleeping instead of `findBy*`/`waitFor` · asserting only on `it()` counts.

## Coverage

Collected, thresholds per file class: `service.ts` and `schema/validation.ts` ≥ 90 percent branches; `repo.ts` ≥ 80; UI ≥ 70. Uncovered branches in services are listed and justified in the PR.

## CI

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`
3. `pnpm knip`, `pnpm audit:structure`, `audit:i18n`, `audit:portability`, `audit:docs`, `audit:schema`, `audit:tests`, `gitleaks`
4. `pnpm test` with a Postgres service container (includes core adversarial suite and audit self-tests)
5. `pnpm build`, `pnpm audit:bundle`
6. `pnpm test:e2e` sharded, both locales, two workspace configurations
7. `pnpm audit:openapi`, `pnpm audit:a11y`
8. `pnpm test:mutate` on the listed critical functions (nightly, not per PR, if runtime exceeds 10 minutes)

Nightly: `ai-smoke.yml`, `pnpm test:mutate`.

## Hand-off requirement

The hand-off lists every requirement ID in the work item with the test file and scenario name that proves it, and the `pnpm audit:all` summary.
