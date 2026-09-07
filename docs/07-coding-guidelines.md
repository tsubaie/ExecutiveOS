# 07 — Coding guidelines

Every rule is labeled by how it is enforced: **[static]** lint or dependency-cruiser fails CI; **[runtime]** a test or audit script fails CI; **[review]** a reviewer checks it against the checklist. Agents do not argue with static or runtime rules; review rules need a written justification to deviate.

## Language and compiler

- **[static]** TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
- **[static]** `any` forbidden. `unknown` allowed at parse boundaries; it must be narrowed by Zod or by `instanceof` within the same function.
- **[static]** Non-null assertions forbidden outside tests.
- **[static]** `as` casts allowed only in: `repo.ts` (Drizzle row to domain type), `catch` clauses narrowing errors, and files under `src/core/db`. Each cast outside tests carries a `// cast: <reason>` comment on the same line (custom rule).
- ESM only. Path alias `@/` → `src/`.

## File and function limits

| Unit | Limit | Enforcement |
|---|---|---|
| React component file | 250 lines | [static] |
| Other `.ts` file | 400 lines | [static] |
| Function | 60 lines, cyclomatic complexity 12 | [static] |
| Props on a component | 12 | [static] |
| `useState` per component | 6 | [static] |

Generated primitives (`src/ui/primitives`) and test files are exempt from the size and prop rules. When a limit is hit, split by responsibility **[review]**.

## Naming

- Files `kebab-case.ts`; components `PascalCase.tsx`; hooks `use-thing.ts` exporting `useThing`.
- DB snake_case; TS camelCase; API camelCase; enum values lower snake_case strings.
- Zod schemas `PascalCase`: `Task`, `TaskCreate`, `TaskUpdate`, `TaskListQuery`; types via `z.infer` share the name.
- Services are verbs (`createTask`); repos are data verbs (`insertTask`, `selectTaskById`).
- Job kinds and query keys use dotted names. Message keys `<module>.<area>.<key>`.
- Requirement IDs `<MODULE>-B<nn>` (behavior) and `<MODULE>-A<nn>` (acceptance) appear in test names and in `rule_violation` details.

## Layering (dependency-cruiser on the real import graph, following re-exports and dynamic imports) [static]

| From | May import | Must not import |
|---|---|---|
| `src/app/**` server files | `modules/*/api`, `modules/*/index` (service surface), `modules/*/ui`, `src/ui`, `core/*` | `modules/*/repo`, `modules/*/schema/db`, `drizzle-orm` |
| `src/app/**` client files, `modules/*/ui/**`, `src/ui/**` | `modules/*/schema/validation`, own `ui/queries`, other modules' `ui/index` (exported reusable components only), `src/ui`, `core/i18n`, `core/http/client` | anything marked `server-only`: `service`, `repo`, `schema/db`, `core/db`, `core/config/env`, `core/ai`, `core/jobs` |
| `modules/*/service` | own `repo`, own `schema`, other modules' `index`, `core/*` | other modules' `repo`, `ui`, `schema/db` |
| `modules/*/repo` | own `schema/db`, `core/db`, `core/links` (edge helpers), `core/search` | anything else |
| `modules/*/jobs`, `modules/*/ai` | own `service`, own `schema`, `core/ai`, `core/jobs` | other modules' internals |
| `core/**` | other `core/*`, `modules/*/index` only from `core/links` resolvers and `core/jobs/registry` | `modules/*/repo`, `modules/*/ui` |
| `core/entity/service` | `core/db/audit-repo`, `core/http/errors` | modules; it receives repo functions as an adapter from the calling service |

- **[static]** Server-only modules import `server-only`; the client bundle audit fails if any of them appears in a client chunk.
- **[static]** `process.env` readable only in `core/config/env.ts`.
- **[static]** No import cycles.

## Data access

- **[static]** SQL only in `repo.ts` and `core/db`, `core/links`, `core/search`, `core/backup`. `sql` fragments allowed for expressions the builder cannot express, never whole statements outside custom migrations.
- **[runtime]** Every list query filters `deleted_at is null` unless `includeDeleted` (repo tests assert).
- **[review]** Multi-statement writes run in `db.transaction`; the service opens it; repos accept the handle.
- **[runtime]** Updates go through the repo update helper, a one-line wrapper over `core/db/entity.ts` (`updateEntity`, `softDeleteEntity`, `restoreEntity`) that applies the revision predicate and bumps `revision` and `updated_at`. Services compose them through `core/entity/service.ts` (`requireRevision`, `applyUpdate`, `restoreByOp`) so conflicts carry the current row and every write is audited.
- **[review]** Lists page with `core/db/keyset.ts`: one `SortSpec` per sort drives ORDER BY, the cursor tuple and the continuation predicate; view counts use `filteredCounts` in one statement.
- **[runtime]** Query count per request ≤ 6 on module golden paths (test asserts with the query logger).

## API and validation

- **[runtime]** Every input crosses a Zod schema before logic (handler wrapper).
- **[static]** Services throw `AppError`; returning `{ error }` objects fails a custom rule.
- **[static]** No `console.*`; use the logger.

## React

- Server components by default; `"use client"` as low as possible **[review]**.
- **[static]** No `fetch`/`axios` in components; no data fetching in `useEffect`.
- **[static]** `useEffect` requires a `// sync: <external system>` comment.
- **[static]** No `dangerouslySetInnerHTML`; markdown through `src/ui/markdown`.
- **[static]** No `alert`, `confirm`, `prompt`. No array-index keys.
- **[review]** No prop drilling beyond two levels.

## Styling

- **[static]** Tailwind + `cn()`. No CSS modules or CSS-in-JS. Inline `style` only with `// runtime-style: <reason>`.
- **[static]** No color literals or palette classes (`no-color-literals`).
- **[static]** Logical properties only (`logical-props` rule bans `ml- mr- pl- pr- left- right- text-left text-right`).
- **[static]** No `transition-all`, no `!important`.

## i18n

- **[static]** No string literals in JSX text or `aria-*`, `title`, `placeholder`, `alt` (`no-literal-strings`); exceptions: punctuation, numbers, whitespace.
- **[runtime]** Both catalogs contain every key; typed keys; `tEnum` namespaces typed; ICU arguments validated (i18n audit).

## Configuration and portability

- **[runtime]** `audit:portability` is a tripwire: it fails on `/Users/`, `/home/`, known personal names from a denylist file, hard-coded IANA timezones and locale codes outside `core/config`, `tests/fixtures`, `e2e/fixtures`, and `scripts/db/seed.ts`. It does not prove portability; the multi-configuration e2e run does (two workspaces with different timezones, locales, and names).
- **[runtime]** Secrets scanning with `gitleaks` in CI.

## Dependencies

- **[review]** Adding a dependency needs a one-line reason and no overlap (one date library: Temporal polyfill; one chart library; one markdown renderer).
- **[runtime]** `knip` clean; exact versions; `pnpm audit` no high or critical without a dated exception file.

## Error handling

- **[static]** No empty `catch`. **[review]** Catch only to add context or recover; rethrow as `AppError`.
- User-facing messages are i18n keys resolved at the boundary.

## Comments and docs

- Comments explain why. `service.ts` starts with a doc comment listing the invariants it protects by requirement ID.
- **[runtime]** The docs audit checks that every module has a spec, that every `<MODULE>-B` and `-A` id in the spec appears in at least one test name, and that every requirement id used in code exists in the spec. Dates are not evidence.

## Git

- Conventional commits scoped by module. One logical change per PR; > 800 lines needs justification.
- Generated files in diffs only under `drizzle/` and `openapi.json`. No AI attribution trailers.

## Forbidden list

`any` · `!` · undocumented casts · `process.env` outside env.ts · `fetch` in components · `useEffect` fetching · inline `style` without reason · color literals · physical direction classes · English literals in JSX · `alert` · clickable `<div>` · empty `catch` · `console.*` · SQL outside repos · `child_process` outside `core/backup` · event emitters for domain effects · TODO without an issue link · placeholder pages · tests that read source files (except `scripts/audit/tests`).
