# Hand-off: feat/core-entity-helpers — typed settings, shared entity helpers, keyset pagination

Status: complete for its scope. Static checks, the unit suite (23 files, 91 tests) and the instant audits pass; the full `pnpm audit:all` gate runs once at the final merge per the maintainer's instruction.

## Summary

The three things every module used to copy now live in core once. Settings are read through a typed registry (`getSetting`/`writeSetting`), so no caller re-parses or re-applies defaults. Revision-checked updates, soft delete with operation provenance and restore-by-op live in `core/db/entity.ts`, composed by `core/entity/service.ts` so conflicts always carry the current row and every write is audited. Keyset pagination and one-statement view counts live in `core/db/keyset.ts`; People and Tasks declare sort specs instead of hand-maintaining parallel ORDER BY and cursor code. Tasks no longer embeds SQL against the People table: People exports its display-name expression.

## Requirement → scenario

| Requirement | Test file | Scenario |
|---|---|---|
| ADMIN-B07 | `src/core/config/tests/settings.test.ts` | registry rejects secret-like keys and non-`claude-*` models; schema and default applied without a row; typed values after a write; invalid values refused and unparsable stored values fall back |
| ADMIN-B12 | same | application version comes from `package.json` (used by health and backup manifests) |
| PEOPLE-B06, TASKS-B12 | `src/core/db/tests/entity.test.ts` | stale revision returns `undefined`; success bumps `revision` and `updated_at` |
| TASKS-I04 | same | restore touches only rows carrying the operation id, once |
| ADMIN-B16 | same | audit payloads serialize dates and drop undefined fields |
| PEOPLE-B02 | same | keyset paging across duplicate names has no repeats or gaps; cursors with a different sort or filter hash are rejected; view counts come from one statement |
| Existing People, Tasks, Users, Home, Settings scenarios | unchanged files | pass unchanged on the refactored services (the "no behavior change" proof) |

## Files changed

- Core: `src/core/config/settings.ts` (typed registry), `src/core/db/settings-repo.ts` (`getSetting`, `hasSetting`, typed `writeSetting`), `src/core/db/entity.ts`, `src/core/db/audit-repo.ts` (moved from `http-repo.ts`, plus `toJson`), `src/core/db/keyset.ts` (replaces `src/core/http/pagination.ts`), `src/core/entity/service.ts`, `src/core/config/env.ts` (memoized, `DB_POOL_MAX`), `src/core/config/version.ts`, `src/core/http/handler.ts` (2 s maintenance-state cache), `src/core/db/auth-repo.ts` (session functions accept a transaction handle; logout uses it).
- Modules: `people/{repo,service,index}.ts`, `tasks/{repo,service}.ts`, `users/{repo,service}.ts`, `home/service.ts`, `settings/service.ts`, `src/app/(app)/layout.tsx`.
- Boundaries: `.dependency-cruiser.cjs` and `tools/eslint/boundary-rules.mjs` treat `src/core/entity/` as server-only.
- Docs: `docs/02-architecture.md` (layout, settings access, `DB_POOL_MAX`), `docs/07-coding-guidelines.md` (update helper and keyset rules), `docs/06-ai-integration.md` (model id validation), `docs/STATUS.md` regenerated, `.env.example`.

## Migrations

None.

## Audits

- `tsc`, `eslint`, `depcruise` (257 modules / 804 dependencies): pass.
- `pnpm test` (tooling container): 23 files, 91 tests passed.
- Instant audits: structure, i18n, portability, docs, tests, dupes, openapi: 0 violations. Warnings unchanged from the previous branch.
- `pnpm audit:all`: deferred to the final merge at the maintainer's request.

## Assumptions

1. `docs/03` § Soft delete: restore is predicated on the operation id only (previously People also required the current revision). The restore API carries no revision, so nothing observable changes.
2. Audit diffs are standardized: create → the validated input, update → the patch without `revision`, delete and restore → `{}` with `opId`.
3. `docs/07` § Layering: Tasks obtains the owner display name through `personNameSql`, an expression exported by People's public surface and embedded by the Tasks repo. Knowledge of People's columns stays in People; the alternative (a second query per list) was rejected to keep golden paths at four queries.
4. Timestamp sort keys are compared as epoch microseconds so cursors cannot skip rows that share a millisecond.
5. `docs/02` § Configuration: `DB_POOL_MAX` added (default 12, the previous hard-coded value).

## Out of scope, noticed

- People's list runs 2 queries and Tasks' 4; Home's summary 4. All well inside the six-query budget.
- The `Filters` types in repos are still string-typed; typing them from the module's Zod list query is a candidate for the entity-framework branch.
