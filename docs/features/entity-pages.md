# Feature: Entity pages (shared list + detail framework)

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** 2026-09-07 for EP-B01, B03, B05–B11, B13, B15, B17 (People and Tasks); B12, B14, B16, B18 and the acceptance walkthroughs remain open
**Owner module:** `src/ui/entity`

## Purpose

One implementation of list + detail behavior for every module: selection, URL state, keyboard navigation, mobile transitions, multiselect, auto-save, loading, empty and error states. Modules supply data hooks, mutation adapters, and renderers. The framework is built alongside Tasks (Phase 2), validated against Notes' multiselect merge (Phase 3), then frozen.

## Public API

```ts
<EntityPage<TItem, TPatch, TCreate>
  module="tasks"
  title={…} description={…}
  filters={{ views, facets?, sort?: { options, default } }}   // the framework owns their URL state
  useList={useTaskList}                      // (filters: { view, q, sort, ...facets }) => ListResult<TItem>
  useDetail={useTaskDetail}                  // (id, trash) => DetailResult<TItem>
  mutations={{                               // adapters; each returns a promise and throws ApiError
    patch: (id, revision, patch: TPatch, key) => Promise<TItem>,
    create: (input: TCreate) => Promise<TItem | null>,
    remove: (id, revision) => Promise<{ opId }>,
    restore: (id, opId) => Promise<TItem>,
  }}
  bulkActions={[{ id, label, enabled?(items), confirm?: { title, description }, run?(items), render?(items, finish) }]}
  emptyState={{ title?, description?, action? }}   // unfiltered empty state only
  group={(item) => heading | null}           // suppressed while a sort is active
  rowAction={(item) => …}                    // sibling control beside the row (completion toggle)
  renderers={{
    row: (item) => …,
    detail: (item, api) => …,                // api: save(patch), close, next, prev, neighbors, remove, restore, saveState, retry
    create: (api) => …,                      // api: submit(input), cancel, pending
    name: (item) => string,
  }}
/>
```

Twelve top-level props is the ceiling (`07-coding-guidelines.md`); related options are grouped (`filters`, `mutations`, `renderers`). A bulk action either runs directly, after the shared confirm dialog, or renders its own dialog through `render(items, finish)`; `finish(true)` clears the selection, `finish(false)` only closes. No `unknown` or `any` in the public types.

## URL state

`?view=&<facets>&q=&sort=&id=<uuid>&new=1&sel=<ids>`.

- EP-B01 Precedence: `new=1` wins over `id`; opening create removes `id`; opening an item removes `new`. `sel` and the open detail are cleared when `view`, facets, `sort`, or `q` change.
- EP-B02 Push versus replace: open item → push; next/prev → replace; close → push (removes `id`); filter changes → replace. Back returns to the list state before the open.
- EP-B03 Deep link to an `id` not in the current filtered list: the detail still opens (fetched by id) and the list shows a banner "not in current view" with "show in All".
- EP-B04 Deep link to a deleted or missing id: detail shows an inline not-found state with Close; the URL keeps `id` until Close (so reload reproduces the state); Close removes it.
- EP-B05 If the selected row is deleted by the current user, detail closes and focus returns to the next row; if it disappears due to a refetch (another member deleted it), detail shows the not-found state.

## Keyboard

- EP-B06 `↑/↓` (`k/j`) move focus; `Enter` opens; `Esc` closes detail, second `Esc` clears filters, third clears selection; `n` create; `x` toggles checkbox in multi mode; `Shift+↑/↓` extends selection; `a` with selection focuses the bulk action bar. Disabled while an input, textarea, contenteditable, or dialog has focus, except `Esc` in a plain field or on a closed picker, which leaves the field and closes the detail once pending saves settle (B11); an open picker keeps `Esc` for itself. The panel bar shows the save state as a pill: a spinner while saving, a tick for two seconds after, a warning until a failed save is retried.

## Layout

- EP-B07 Desktop (≥ 1024 px): rail 208 px (collapsible, ≥ 1280 px), list, detail 480 px inline; list resizes, never shifts. The list column opens with one sticky bar that carries the page title, the current view and its count (a button into the filter sheet where the rail is hidden), search, Filter, selection mode and the primary Create action; the page description is exposed to assistive technology only. Below 640 px the search group wraps under the title. Rows are 44 px single-line by default; group headers are 28 px; rail items 32 px with a divider before views marked `separated`. Views marked `featured` also show their count in a strip under the bar (tinted by `tone` when the count is above zero); views may carry an `icon` for the rail. While a panel is open the shell sidebar and the rail soften with a light blur, and while the create form is open the list softens too; hovering or focusing an element restores it, colours do not change, and the effect is skipped under reduced motion transitions. The panel bar shows the item's position in the loaded list ("3 of 11") when no save is in flight.
- EP-B08 Mobile: views `list` → `detail` → `create`, full screen, slide from the end side (`dir`-aware); rail as a bottom sheet with active-filter count. Back gesture and browser back both go to the previous view.
- EP-B09 Direction: all animation and column order derive from `dir`.

## Auto-save

- EP-B10 `api.save(patch)` queues per entity: one request in flight; newer patches coalesce; each request sends the latest known `revision`. State `idle → saving → saved (2 s) → idle`, or `error` with Retry (same idempotency key) and, on 409, `conflict` with "Reload and reapply" that refetches, shows the diff of the user's pending patch, and reapplies on confirm.
- EP-B11 Navigating away (close, next, prev, view change, same-origin links) while a save is pending waits for it; while a save is in `error`, a dialog asks to retry or discard. Guards are registered through the framework's navigation context and scoped to the active panel, so an entity surface embedded in another module guards only itself; an invalid autosaved field (inside a `data-autosave` container) blocks navigation and reports its validity message; secondary forms in the panel do not.
- EP-B12 Optimistic updates apply to the list row and detail; on error they roll back. A row that leaves the loaded list after a mutation (completed, trashed, restored) stays rendered and inert for one 300 ms fade-and-collapse; a full replacement of the list (view, filter or search change) is not animated. Under reduced motion the exit is immediate.

## Lists

- EP-B13 Infinite paging with `fetchNextPage` on scroll; next/prev at the end of the loaded page loads the next page before moving.
- EP-B14 Grouping renders headers with counts over the loaded rows and, when `meta.counts` provides a group count, the full count in parentheses; collapse state per module in local storage. The selected row is marked with the accent-soft ground and a 3 px start-edge bar.
- EP-B15 Empty states: no items at all (primary action) versus no matches (clear filters); the module may supply the icon through `emptyState.icon`. While the first page loads the list shows six placeholder rows at row height, and while an item loads the detail shows a placeholder title, property rows and text block.
- EP-B16 Errors: list error panel with retry and request id; detail error inline.
- EP-B17 Focus: opening detail moves focus to the title; closing returns focus to the row; create returns focus to the new row after submit.
- EP-B18 Query client is recreated on login and logout; list refetch on focus and every 60 seconds while visible.

## Acceptance criteria

- EP-A01 Tasks and Notes render with the framework and contain no page-level implementation of selection, URL state, keyboard, mobile transitions, or auto-save (structure audit: the module `ui/` has no `useSearchParams`, `matchMedia`, `history`). (en)
- EP-A02 `/tasks?view=overdue&id=<uuid>` opens the view and item on desktop and mobile; back returns to the list. (en, ar)
- EP-A03 Keyboard-only walkthrough: list → open → edit title → save → close, with visible focus at each step. (en, ar)
- EP-A04 Two rapid edits produce one or two requests, never out of order; a 409 keeps the draft and offers reapply. (en)
- EP-A05 In Notes, selecting three threads with `x` and running Merge from the bulk bar merges them. (en)
- EP-A06 RTL: detail panel on the left, mobile detail slides from the left, arrows move in list order. (ar)

## Required scenarios

- `src/ui/entity/tests/url-state.test.tsx`: B01–B05.
- `keyboard.test.tsx`: B06 including disabled-in-inputs.
- `mobile.test.tsx`: B08, B09.
- `autosave.test.tsx`: B10–B12 with fake timers, overlapping saves, 409 path, navigate-while-pending.
- `list.test.tsx`: B13–B18.
- `multiselect.test.tsx`: selection clearing rules, bulk action confirm.
- `bulk-actions.test.tsx`: confirm flow runs once, render escape hatch, disabled predicates.
- `navigation-guard.test.tsx`: registered guard defers, unregistered surface navigates, guards leave with their owner.
- `keyboard.test.ts`: `a` opens bulk actions, `x` toggles, shortcuts ignored in inputs.
- e2e `entity-framework.spec.ts`: A02, A03, A06 in both locales.
- Mutation targets: `resolveUrlState`, `saveQueue`, `keyboardHandler`.

## Audit items

- No module page file exceeds 250 lines.
- The framework has zero imports from `src/modules`.
