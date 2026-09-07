# Hand-off: chore/oss-readiness — publication surface

Status: complete. The full `pnpm audit:all` gate passed on this final branch (summary below).

## Summary

The repository now reads like a project a stranger can pick up: a README status that matches reality and points at `docs/STATUS.md`, contributor and conduct documents, issue and pull request templates mirroring the PR audit in `docs/09`, a security policy with a reporting channel, Node pinned for local toolchains, and eight representative screenshots instead of ninety-two. Hand-offs, unused dependencies and dead exports were handled in the earlier branches of this series.

## Files changed

- `README.md` (Status, checks, screenshots, hand-off pointers), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (reporting channel, supported versions), `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.mise.toml`, `.nvmrc`.
- `docs/screenshots/`: kept `home-en-desktop`, `home-ar-desktop`, `tasks-list-en-desktop`, `tasks-list-ar-desktop`, `tasks-detail-en-desktop`, `people-list-ar-desktop`, `admin-settings-en-desktop`, `login-ar-desktop`; removed 84 files (4.3 MB → 440 KB). `tools/capture-*.mjs` write the full matrix to the ignored `tmp/screenshots/`.
- `docs/02-architecture.md` layout (new root files), `docs/STATUS.md` regenerated.
- Removed three unused helper exports (`resetEnv`, `settingEntry`, `resetMaintenanceCache`) so `audit:deps` stays clean.

## Migrations

None.

## Assumptions

1. `SECURITY.md` names GitHub Security Advisories as the private channel; the maintainer supplies an email address in the repository description if they prefer one.
2. The Code of Conduct is an adaptation of the Contributor Covenant 2.1 with attribution, not the verbatim text.

## Out of scope, noticed

- A `CHANGELOG.md` and the release checklist in `docs/09` § F remain for the 1.0 hardening phase.
- The Docker image publication and the clean-VM quick-start drill are release tasks.

## Final `pnpm audit:all` summary (final branch, tooling container, isolated `executiveos_e2e_test` and `executiveos_test` databases)

```text
lint, typecheck: pass
depcruise: no dependency violations found (267 modules, 867 dependencies cruised)
audit:structure: 0 violation(s), 0 warning(s)
audit:i18n: 0 violation(s), 17 warning(s)          dynamic keys per file
audit:portability: 0 violation(s), 0 warning(s)
audit:docs: 0 violation(s), 11 warning(s)          coverage gaps in accepted specs
audit:schema: 0 violation(s), 0 warning(s)
audit:tests: 0 violation(s), 5 warning(s)          missing layers for accepted modules
audit:deps: 0 violation(s), 0 warning(s)
audit:secrets: 0 violation(s), 0 warning(s)
test: 29 files, 106 tests passed
build: pass (pre-existing Edge-runtime warnings from src/instrumentation.ts)
audit:bundle: 0 violation(s), 1 warning(s)         166 KB gzipped root bundle
test:e2e: 35 passed (desktop and mobile projects)
audit:openapi: 0 violation(s), 0 warning(s)
audit:a11y: 0 violation(s), 0 warning(s)           11 routes in en, ar
audit:perf: 0 violation(s), 5 warning(s)           2–8 ms, 2–4 queries per golden path
audit:dupes: 0 violation(s), 0 warning(s)
```

The first pass of this gate exposed one defect from the entity-framework branch: the navigation guard checked every invalid input in the panel, and the empty required "add subtask" field blocked every navigation. The guard is now scoped to autosaved fields (`data-autosave`), the spec sentence for EP-B11 says so, and the browser stages were rerun on a fresh build.

## CI follow-ups after publishing

- `f598ffa`: the database-backed audits now create the `*_test` database themselves; on a fresh runner only the application database exists.
- Node 22.12.0 segfaults when the `argon2` native binding loads (reproduced locally with mise; 22.14.0, 22.20.0 and 22.23.2 are fine). CI, `.mise.toml` and `.nvmrc` pin 22.23.2 and `engines` requires `>=22.14.0`.
- CI caches the Playwright browsers and `.next/cache`; the measured gate was already short (install 14 s, browsers 19 s, lint through build 73 s, Docker build 68 s), so the savings are modest.
