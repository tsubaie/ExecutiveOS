# Hand-off: search — one field, one launcher

Status: complete

## Summary

Every entity page showed two things to type into: the workspace search, drawn as a bordered field
stretched across the shell header, and the list's own search field one row below it. Both hit the
same trigram corpus with the same normalisation, so a reader had to guess which one they meant.
The two do different jobs — the list's field filters in place and composes with facets and sort,
the palette answers "where is this" and hands over a record — and the page now shows that. The
header control is a launcher: a ghost button at its natural width beside the bell and the account,
the icon alone on a phone, never a field. The list's field names its module ("Search tasks",
"Search notes") through a required `searchLabel` on the page declaration. And the two hand off to
each other instead of asking for the phrase twice: a list's no-matches state offers "Search the
workspace" with the phrase carried in, and the palette opened over a list offers "Search in Tasks
for “…”" as its first row, filtering the list in place.

No new decision: the search spec already said the control is a button and collapses to the icon on
a phone; the code did neither. SEARCH-B11, SEARCH-B12 and EP-B41 write the rest down.

## Requirement → scenario

| ID | Test file | Scenario name |
|---|---|---|
| SEARCH-B11 | `e2e/search.spec.ts` | SEARCH-B11 the header search is a launcher with a word on a desktop and an icon on a phone (en, ar) |
| SEARCH-B12 | `e2e/search.spec.ts` | SEARCH-B12 the palette opened over a list hands the phrase to that list (en, ar) |
| SEARCH-B12 | `src/ui/layout/tests/search-palette-store.test.ts` | SEARCH-B12 a list on screen registers a scope the palette can hand a query to, and withdraws it |
| EP-B41 | `e2e/entity-search.spec.ts` | EP-B41 the field names its module and the no-matches state hands the phrase to the workspace search (notes, tasks × en, ar) |
| EP-B41 | `src/ui/layout/tests/search-palette-store.test.ts` | EP-B41 opening the palette from a list carries the phrase it could not find, and closing drops it |

Existing scenarios that located the list field by the old shared name ("Search…") now use the
module's own label: `e2e/entity-search.spec.ts` (EP-B15, EP-B22) and `e2e/tasks.spec.ts` (EP-B01
EP-B02 search keeps typing focus…).

## Files changed

- `src/ui/layout/search-palette-store.ts` — new: open state, the phrase carried in, and the scope
  of the list on screen, read through `useSyncExternalStore` so the header and the framework never
  import each other.
- `src/ui/layout/ShellHeader.tsx` — the launcher; opens through the store.
- `src/ui/layout/SearchPalette.tsx` — `initialQuery`; the hand-off row; the query hook split out.
- `src/ui/entity/` — `types.ts` (`searchLabel`), `EntitySearch.tsx` (label is placeholder and
  name), `EntityControls.tsx`, `EntityStates.tsx` (the second empty-state action),
  `use-entity-controller.ts` (registers the scope while mounted), test fixtures.
- `src/modules/{tasks,notes,people,committees,kpis}/ui/*Page.tsx`, `CommitteeTasks.tsx`,
  `CommitteeNotes.tsx` — each names its field.
- `src/core/i18n/messages/{en,ar}.json` — `common.searchOpen`, `common.searchWorkspace`,
  `common.searchScope`; `<module>.searchList` × 5.
- `docs/features/search.md` (SEARCH-B11, B12, UI section, required scenarios),
  `docs/features/entity-pages.md` (EP-B41).

## Migrations

None.

## Audits

`pnpm audit:all` in the tooling container, 2026-09-16:

- `audit:static` — lint, typecheck, depcruise (576 modules, no violations), structure 0/0, i18n 0/0,
  portability 0/0, docs 0 violations / 13 warnings (pre-existing: spec IDs without scenarios in
  accepted specs, including search A01–A04), tests 0/9, deps 0/0, secrets 0/0, dupes 0/0.
- `audit:data` — schema 0/0; vitest 85 files, 402 tests passed.
- `audit:browser` — build; bundle 0 violations / 1 warning (167 KB shared root bundle,
  pre-existing); Playwright 134 passed in both projects; openapi 0/0; a11y 0/0; perf 0 violations /
  5 informational samples.

The first browser runs failed for reasons outside the change and are recorded in the tooling notes:
the e2e account no longer matched `e2e/.auth/credentials.json` (reset the disposable e2e database),
and a server from a stopped run was still holding port 3000 with the job runner's shutdown
transaction open. The stage was re-run clean after each.

## Manual verification

en desktop ✔ (maintainer, on the branch dev server) / ar desktop, en 390px, ar 390px — through the
browser suite only (`search.spec.ts`, `entity-search.spec.ts` run both locales at 1280 and 390 px).

## Assumptions

1. The launcher sits in the header's end cluster with the bell and the account rather than at the
   start where the field was. The search spec's UI section did not say where; it now does
   (SEARCH-B11).
2. The hand-off from the palette into a list writes a history entry (Back returns to the unfiltered
   list), where typing in the field replaces. A hand-off is a step the reader took; keystrokes are
   not. Recorded in SEARCH-B12.

## Open questions

None.

## Out of scope, noticed

- `features/search.md` still carries unimplemented contract items: SEARCH-B10 recent hits and the
  SEARCH-B06 "showing N" count are not in `SearchPalette.tsx`, and the required scenarios for
  A01–A04, `normalize.test.ts`, the registry provider case and per-module `search.test.ts` do not
  exist. The spec header still says "Implementation verified: not yet".
- The gate regenerated `docs/screenshots/tasks-*.png`, which now show the launcher and the named
  field; `notes-*.png` and `kpis-*.png` still show the old header field and want a capture run.
