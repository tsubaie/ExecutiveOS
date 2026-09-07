# Hand-off: fix/entity-framework-api — sort, bulk actions, empty state, navigation context

Status: complete for its scope. Static checks, the unit suite and the instant audits pass; browser scenarios were re-run for this branch because the shared framework changed; the full `pnpm audit:all` gate runs once at the final merge per the maintainer's instruction.

## Summary

The entity page framework now matches its spec closely enough to be reused by Notes without page-level workarounds. Sort is a first-class option beside views and facets (URL `sort=`, grouped headings suppressed while sorting). Bulk actions are declarative: a shared bar with per-action enablement, an optional confirm dialog, or a module-rendered dialog through `render(items, finish)`. Modules may override the unfiltered empty state. The detail API exposes `next`, `prev` and `neighbors`. Navigation guards moved from a window event and a document-wide listener into a React context scoped to the surface, so an entity panel embedded in another module guards only itself; the invalid-field check is scoped to the panel too. Keyboard handling subscribes once per surface through `useEffectEvent`.

## Requirement → scenario

| Requirement | Test file | Scenario |
|---|---|---|
| EP-B01 | `src/ui/entity/tests/url-state.test.ts` | changing the sort clears selection and detail like a view change; precedence unchanged |
| EP-B06 | `src/ui/entity/tests/bulk-actions.test.tsx` | confirmed action runs once and clears the selection; render escape hatch receives items; disabled predicates keep an action inert |
| EP-B06 | `src/ui/entity/tests/keyboard.test.ts` | `a` with a selection opens the bulk bar, `x` toggles the focused row, shortcuts ignored in inputs, Escape clears |
| EP-B11 | `src/ui/entity/tests/navigation-guard.test.tsx` | registered guard defers navigation; unguarded surface navigates immediately; declined guard blocks; guards leave with their owner |
| EP-B15 | `src/ui/entity/tests/filter-state.test.ts` (existing) | clearing removes facets, search, sort, selection and detail |
| TASKS-A05, TASKS-B09 | `e2e/tasks.spec.ts` (existing) | grouping through the bulk bar and its dialog |
| EP-B03, EP-B06, EP-B07, EP-B08, EP-B10, EP-B11, EP-B15, EP-B17 | `e2e/tasks.spec.ts`, `e2e/preview.spec.ts` (existing) | filters sheet with sort and facets, keyboard selection, failed-save guard, focus restoration; People regressions on the shared layout |

## Files changed

- `src/ui/entity/types.ts` (grouped `filters`, `bulkActions`, `emptyState`, `DetailApi.next/prev/neighbors`), `url-state.ts` (sort), `navigation.tsx` (new context; replaces `use-link-guard.ts` and `use-navigation-guard.ts`), `use-entity-controller.ts`, `use-entity-keyboard.ts`, `EntityBulkBar.tsx` (new), `EntityControls.tsx`, `EntityList.tsx`, `EntityPanel.tsx`, `EntityPage.tsx`.
- Modules: `tasks/ui/TasksPage.tsx` (declarative filters and bulk action), `tasks/ui/GroupTasks.tsx` (dialog-only), `tasks/ui/TaskFields.tsx` (autosave marker removed), `tasks/ui/OwnerTasks.tsx`, `people/ui/PeoplePage.tsx`, `people/ui/queries.ts` (empty filters omitted from the query string).
- Messages: `common.selectedCount`, `common.actions` in both catalogs.
- Docs: `docs/features/entity-pages.md` (Public API, EP-B01, EP-B06, EP-B11, Required scenarios, Implementation verified).

## Migrations

None.

## Audits

- `tsc`, `eslint`, `depcruise`: pass.
- `pnpm test` (tooling container) and Playwright: see the commit body for counts.
- Instant audits (structure, docs, tests, i18n): 0 violations.
- `pnpm audit:all`: deferred to the final merge at the maintainer's request.

## Assumptions

1. `docs/features/entity-pages.md` Public API: props are grouped to respect the twelve-prop ceiling; `bulkActions` entries may render their own dialog because a title prompt cannot be expressed as a confirm.
2. EP-B06: `a` focuses the bulk bar rather than opening a menu; the bar is the actions surface.
3. EP-B11: same-origin link interception stays document-wide but is active only while a surface has a registered guard, so shell links still wait for a pending save.
4. `People` sends no empty query parameters; the list endpoint's `sort` enum has no empty member.

## Out of scope, noticed

- EP-B12 (optimistic updates), EP-B14 (group counts and persisted collapse), EP-B16 (detail error inline) and EP-B18 (query client recreation) remain open and are listed in the spec header.
- `Filters` is still an index signature; typing facet keys per module would need the list query schema to flow into the framework.
