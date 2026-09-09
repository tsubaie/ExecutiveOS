# Contributing to ExecutiveOS

Thank you for helping. This project is built to be extended module by module, so most contributions follow the same path.

## Before you start

- Read `AGENTS.md`, then `docs/README.md` in the order it lists. The documents under `docs/` are the specification; `docs/07-coding-guidelines.md` is enforced by lint, the audit scripts and review.
- Every behavior has a requirement ID (`TASKS-B03`, `EP-A02`). Work items name the IDs they implement, and every implemented ID has a scenario whose test name contains it.
- Branch names: `feat/<module>-<slug>`, `fix/<module>-<slug>`, `chore/<slug>`, `docs/<slug>`. Never commit to `main`.

## Setting up

Node 22 and pnpm 10 (`corepack enable`). Copy `.env.example` to `.env` for the Docker stack, and for tests:

```bash
docker compose -f docker-compose.test.yml up -d
cp .env.test.example .env.test
pnpm install
pnpm test
```

See the Development section of `README.md` for the browser suite and the full gate.

## The gate

`pnpm audit:all` must pass before a pull request is opened. It runs lint, types, the dependency graph, thirteen audit scripts, the unit and integration suites, the production build, the browser suite, and the accessibility and performance checks. Locally it needs the `gitleaks` binary and a production build; CI installs both. The gate is grouped into `audit:static`, `audit:data` and `audit:browser`, which CI runs as parallel jobs; run a single group while iterating and `audit:all` before you open the pull request.

If an audit fails on something the docs did not anticipate, fix the code or fix the document in the same pull request. Never weaken a rule to get green.

## Adding a module

1. Create `src/modules/<name>/` with the manifest entries listed in `docs/02-architecture.md` § Module manifest, and `docs/features/<name>.md` from `docs/templates/feature-spec.md`.
2. Register it in `src/core/modules/client.ts` (navigation) and `src/core/modules/registry.ts` (home sections, job kinds). Nothing else lists modules.
3. Build lists with `EntityPage` (`src/ui/entity`), data access with the helpers in `src/core/db/entity.ts` and `src/core/db/keyset.ts`, and settings through `getSetting`.
4. Add `en` and `ar` messages together; render dates and counts through `src/ui/format.ts`.

## Pull requests

Use the pull request template: requirement → scenario table, spec sections changed, `pnpm audit:all` summary, and recorded assumptions. One logical change per pull request; keep it under 800 lines unless the description says why.
