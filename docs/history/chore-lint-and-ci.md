# Hand-off: chore/lint-and-ci — lint splits, reproducible test harness, CI

Status: complete for its scope. The full `pnpm audit:all` gate is still not green because thirteen audit scripts do not exist yet; that is the next branch (`chore/audit-gate`).

## Summary

The nine ESLint size and complexity errors and the shell navigation warning are fixed by responsibility splits, with no rule changed or disabled. Unit and integration tests provision and guard their own `*_test` database, browser tests provision their own administrator through the real first-run setup API, and a GitHub Actions workflow runs the existing gate steps with a PostgreSQL service container.

## Requirement → scenario

| Requirement | Evidence |
|---|---|
| `docs/07` function and file limits (static) | `eslint . --max-warnings=0` passes; splits in `src/core/db/jobs-repo.ts` (`admits`, `sweepQueue`, `selectCandidate`, `writeClaim`), `src/core/jobs/runner.ts` (`runJob`, `startHeartbeat`), `src/modules/people/ui/PersonForm.tsx` (field-group components), `src/modules/users/ui/AdminDataPage.tsx` (`AiPanel`, `ResourceList`, `BackupsHeader`, `AdminRow`), `src/modules/users/ui/UsersPage.tsx` (`UsersList`), `src/ui/layout/AuthForm.tsx` (`SetupFields`, `RecoveryTokenField`, `CredentialFields`, `authBody`). |
| `docs/08` test database isolation | `tests/setup/test-database.test.ts` — `refuses a database name without the _test suffix`; `tests/setup/global-setup.ts` creates the database when missing. |
| `docs/08` CI runs on a fresh checkout | `.github/workflows/ci.yml` (lint, typecheck, depcruise, test, build, e2e; Docker runtime build). |
| Existing scenarios unchanged | Vitest 58 passed / 11 files; Playwright 18 passed (People, Admin, Tasks in en and ar). |

## Files changed

- Lint splits: the six source files listed above plus `src/ui/layout/AppShell.tsx` (`router.push` instead of `location.assign`).
- Test harness: `tests/setup/*`, `vitest.config.ts` (`globalSetup`, `tests/**` include), `package.json` (`test*` scripts load `.env.test` through `node --env-file-if-exists`; `db:e2e-account`), `docker-compose.test.yml`, `.env.test.example`, `.gitignore` (`e2e/.auth/`, keep the example).
- Browser tests: `scripts/db/e2e-account.ts`, `e2e/global-setup.ts`, `e2e/fixtures/auth.ts`, `playwright.config.ts` (`globalSetup`, `webServer`), `tools/playwright-docker.config.ts`, `e2e/preview.spec.ts` and `e2e/tasks.spec.ts` (shared `loginAs`; ADMIN-A01 no longer needs the original setup token).
- CI: `.github/workflows/ci.yml`. Docs: `README.md` § Development.

## Migrations

None.

## Audits

- `eslint . --max-warnings=0`: pass (was 9 errors, 1 warning).
- `tsc --noEmit`: pass. `depcruise`: pass, 251 modules / 777 dependencies.
- `pnpm test` (tooling container, `_test` database): 11 files, 58 tests passed.
- Playwright (`tools/playwright-docker.config.ts` against the running preview): 18 passed.
- `pnpm build`: pass.
- `pnpm audit:all`: lint, typecheck and depcruise pass, then `audit:structure` fails because `scripts/audit/structure.ts` does not exist. `knip` still reports pre-existing unused files and dependencies; it is excluded from the workflow until `audit:deps` lands.

## Assumptions

1. `docs/10` § Implementer procedure says branch from `main`; `main` holds documentation only, so this branch continues from `fix/tasks-ux-foundation` like the previous work.
2. `docs/07` forbids `process.env` outside `core/config/env.ts` with no test exemption. The browser-test provisioning therefore runs as a `scripts/db` program that imports `env()` the same way `db:seed` does, and the Playwright global setup spawns it instead of reading environment variables.
3. The e2e administrator is created only when the workspace has no users; an initialized workspace requires an operator-supplied `e2e/.auth/credentials.json`. This keeps the setup token path identical to production (ADMIN-B01).
4. `.github/` and `tests/` are not in the `docs/02` repository layout table; the structure audit in the next branch reconciles the table.

## Out of scope, noticed

- `knip` unused files (`core/ai/fake.ts`, `core/ai/provider.ts`, module `index.ts` files nothing imports yet) and five unused dependencies remain for `chore/oss-readiness`.
- `AuthForm` still reloads through `location.assign` after login and recovery; a full reload after a session change is intentional and the lint rule does not flag it.
