# AGENTS.md — operating contract for AI agents working on ExecutiveOS

This file is the entry point for every agent session. It is short on purpose. The detailed rules live in `docs/` and are binding.

## Precedence

When documents disagree: a feature spec beats a guideline for behavior; an ADR beats everything for a decision it records; `07-coding-guidelines.md` beats a feature spec for how code is written. If two documents of the same rank disagree, stop and escalate (see `10-agent-workflow.md`).

## Read this order before touching code

1. `docs/README.md` — index and reading order
2. `docs/10-agent-workflow.md` — how work is assigned, executed, verified, and handed back
3. `docs/07-coding-guidelines.md` — rules enforced by lint, audit scripts, and review
4. The feature spec for the module you are working on: `docs/features/<module>.md`
5. `docs/09-audit-checklists.md` — what you must verify before you finish

## Non-negotiable rules

- Never commit to `main`. Branch names: `feat/<module>-<slug>`, `fix/<module>-<slug>`, `chore/<slug>`, `docs/<slug>`.
- Never push, open a PR, or touch remote branches unless the work item explicitly says so.
- Every requirement you implement has an ID (`TASKS-B03`, `MEET-A05`) and a named test that fails when the behavior is removed. Tests that read source files as strings are forbidden outside `scripts/audit/tests`.
- Run `pnpm audit:all` before declaring work done, and paste its summary in the hand-off.
- No SQL outside `src/modules/*/repo.ts` and `src/core/db/`. No `fetch` inside React components. No color literals or inline styles in TSX.
- No personal or environment-specific values in code. Configuration lives in `src/core/config`; test fixtures may contain sample values in `tests/fixtures/`.
- No dependency on separately installed tools or separately running services. AI calls go through `src/core/ai` using `@anthropic-ai/sdk`. The only subprocesses allowed are the PostgreSQL client binaries bundled in the image, called from `src/core/backup` (ADR 0008).
- If a spec is ambiguous, apply the rule in `10-agent-workflow.md` § Assumptions versus escalation. Never invent product behavior.
- A behavior change updates the feature spec in the same PR. A new decision adds a new ADR; accepted ADRs are never edited, only superseded.

## Commands

```bash
pnpm install
pnpm dev                 # app on :3000
pnpm db:migrate          # apply migrations (also runs on container start)
pnpm db:reset            # drop, migrate, seed (dev only)
pnpm test                # unit + integration (needs test DB)
pnpm test:e2e            # Playwright
pnpm audit:all           # lint, typecheck, dependency graph, tests, build, structure audit
```

## Project layout

```
src/app/            Next.js routes (thin; delegates to modules)
src/core/           config, db, auth, http, jobs, ai, i18n, links, files, backup, search
src/modules/<m>/    schema/ repo.ts service.ts api.ts jobs.ts ai/ ui/ tests/ index.ts
src/ui/             design system + entity page framework
docs/               specs, guidelines, audits, ADRs
```

Full detail: `docs/02-architecture.md`.
