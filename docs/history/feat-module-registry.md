# Hand-off: feat/module-registry — module manifests, typed routes, formatting module

Status: complete for its scope. Static checks, the unit suite and the instant audits pass; the full `pnpm audit:all` gate runs once at the final merge per the maintainer's instruction.

## Summary

Adding a module no longer means editing the shell, the home page and the job registry by hand. Each module ships a client-safe `manifest.ts` (navigation) and a `server` export in `index.ts` (home section providers, job kinds). `core/modules/client.ts` and `core/modules/registry.ts` compose them; `core/jobs/registry.ts` merges system kinds with module kinds and refuses duplicates. Every application URL is built by `core/routes.ts`. Dates and counts render through `src/ui/format.ts`, fed by request-level formats that carry the workspace or user timezone and numerals; the ad-hoc formatters in Tasks and Admin are gone.

## Requirement → scenario

| Requirement | Test file | Scenario |
|---|---|---|
| HOME-B03 | `src/core/modules/tests/registry.test.ts` | every home provider answers within two queries and returns absolute hrefs |
| ADMIN-B15 | same | job registry contains the system kinds, has no duplicates, refuses a kind registered twice |
| EP-A01 | same | navigation comes from manifests, sorted by order, admin entries hidden from members |
| EP-B01, EP-B03 | `src/core/tests/routes.test.ts` | task deep links carry view and id and omit empty parameters |
| TASKS-B03, docs/05 numerals | `src/ui/tests/format.test.tsx` | Arabic-Indic digits under the `arab` numbering system; a plain date renders the same calendar day at UTC+14 and UTC-11 |
| HOME-B02 | `src/modules/home/tests/service.test.ts` (existing) | absent modules still collapse to disabled sections with `href: null` |

## Files changed

- Core: `src/core/routes.ts`, `src/core/modules/{manifest,server-manifest,client,registry}.ts`, `src/core/jobs/{types,registry,runner}.ts` (`JobHandler` type, merged registry, `jobKinds`), `src/core/http/admin-api.ts`, `src/core/i18n/request.ts` (server-only; timezone and numerals from settings), `src/ui/format.ts`.
- Modules: `manifest.ts` in home, tasks, people, users, settings; `index.ts` exports `manifest` and `server`; `home/schema/validation.ts` and `home/service.ts` (providers, hrefs); `tasks/service.ts` `homeSummary` returns hrefs; `HomePage`, `TaskRow`, `TaskDetail`, `OwnerTasks`, `AdminDataPage`, `EntityControls` use `format` and `routes`.
- Shell: `ShellLinks` reads `navigation(role)`; `src/ui/layout/nav.ts` deleted; `AppShell`, `AuthForm`, `AdminLayout` and the `src/app` redirects use `routes`.
- Boundaries: `.dependency-cruiser.cjs` (`module-manifest-is-client-safe`, `core-modules-client-imports-manifests-only`, `core/modules` may import module surfaces, registry is server-only) and the ESLint server marker.
- Docs: `docs/02-architecture.md` (module manifest row, registry paragraph, layout), `docs/05-ui-guidelines.md` (formatting), `docs/features/home.md` (HOME-B03 hrefs), `docs/STATUS.md`; structure-audit fixtures gained `manifest.ts`.

## Migrations

None.

## Audits

- `tsc`, `eslint`, `depcruise` (267 modules / 865 dependencies): pass.
- `pnpm test` (tooling container): see the summary line in the commit.
- Instant audits (structure, docs, tests, portability, i18n, dupes, openapi): 0 violations.
- `pnpm audit:all`: deferred to the final merge at the maintainer's request.

## Assumptions

1. `docs/02` § Module manifest: `manifest.ts` is a required entry for every module; modules without navigation export `{ id }` only.
2. Admin tabs in `AdminLayout` stay a static list: they are core-owned surfaces, not module contributions.
3. `docs/features/home.md` HOME-B03: sections and items carry `href` so the page never composes URLs for other modules. The response gained two fields; no client depended on their absence.
4. Numerals reach the client through `next-intl` named formats rather than a `-u-nu-` locale extension, so `useLocale()` keeps returning the bare `en`/`ar` values the code compares against.
5. Plain dates are rendered at UTC from their year, month and day; `Temporal` stays server-side so the client bundle does not grow.

## Out of scope, noticed

- `core/i18n/request.ts` now reads up to four settings per server render; a per-request settings cache is a natural follow-up if server rendering cost matters.
- Job kinds are validated by a runtime refinement instead of a literal union; the first module job will show whether a generated union is worth it.
