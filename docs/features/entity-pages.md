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
    rowTrail: (item) => …,                   // sibling of the row button, so it may hold a control
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

- EP-B06 `↑/↓` (`k/j`) move focus; `Enter` opens; `Esc` closes detail, second `Esc` clears filters, third clears selection; `n` create; `x` toggles checkbox in multi mode; `Shift+↑/↓` extends selection; `a` with selection focuses the bulk action bar. Disabled while an input, textarea, contenteditable, or dialog has focus, except `Esc` in a plain field or on a closed picker, which leaves the field and closes the detail once pending saves settle (B11); an open picker keeps `Esc` for itself. Opening a record takes focus off the row before the panel exists to receive it, so while the record loads the active element is the document body, outside the surface the shortcuts are delegated from; `Esc` is also handled from the document for exactly that case, guarded on this surface having a panel open and on focus being nowhere at all, so it closes the panel instead of doing nothing. The panel bar shows the save state as a pill: a spinner while saving, a tick for two seconds after, a warning until a failed save is retried.

## Layout

- EP-B07 Desktop (≥ 1024 px): rail 208 px (collapsible, ≥ 1280 px), list, detail inline at `clamp(480px, 46%, 880px)` of the workspace (rail included, so it reads as roughly 55/45 against the list); the list takes the remainder and resizes, never shifts. The open record carries the wider of the two columns (EP-B23): 480 px stays the floor, so no width loses room against the fixed panel it replaces. The list column opens with one sticky bar that carries the page title, the current view and its count (a button into the filter sheet where the rail is hidden), search, Filter, selection mode and the primary Create action; the page description is exposed to assistive technology only. Card lists place Create above the desktop views rail and use a compact search/sort/action toolbar; without a visible rail, the title/view and Create remain above it (EP-B22). Rows are 44 px single-line by default; group headers are 28 px; rail items 32 px with a divider before views marked `separated`. Views marked `featured` also show their count in a strip under the bar (tinted by `tone` when the count is above zero); views may carry an `icon` for the rail. While a panel or the create form is open the shell sidebar, the rail and the list soften with a light blur so only the open record reads sharp, and they stay soft for as long as the record is open (EP-B23). Colours do not change. Keyboard focus is the single exception: focus within one of those surfaces restores it, because tabbing into the list has to leave it readable. The pointer does not, so passing over the list on the way to something else does not flicker it back and forth. The panel bar shows the item's position in the loaded list ("3 of 11") when no save is in flight; it carries no previous/next controls, moving between items is done from the list.
- EP-B08 Mobile: views `list` → `detail` → `create`, full screen, slide from the end side (`dir`-aware); rail as a bottom sheet with active-filter count. Back gesture and browser back both go to the previous view.
- EP-B09 Direction: all animation and column order derive from `dir`.

## Forms

- EP-B20 `renderers.rowTrail` renders beside the row button, after it, mirroring the leading slot that carries the checkbox and `rowAction`. The output of `renderers.row` sits inside the row button and therefore may not contain a control of its own; anything interactive on a row belongs in the leading or trailing slot. The slot is optional and adds no markup when absent.
- EP-B21 The framework also owns the two small shells modules would otherwise copy: `EntityCreateForm` (focusable heading, last error, the module's fields, Create and Cancel; the module parses the form data) and `EntityActionDialog` (a bulk action with one small form, rendered through the bulk bar's escape hatch; closing without submitting keeps the selection).
- EP-B19 The shared `Field` owns the identifiers for one control: the label points at the control with `htmlFor`, a hint is referenced with `aria-describedby`, an error with `aria-errormessage`, and `aria-invalid` is set only while an error is shown. Children are a render prop receiving those attributes, so the consumer keeps its own control. Submitting an invalid form focuses the first invalid field (`react-hook-form` default).

## Auto-save

- EP-B10 `api.save(patch)` queues per entity: one request in flight; newer patches coalesce; each request sends the latest known `revision`. State `idle → saving → saved (2 s) → idle`, or `error` with Retry (same idempotency key) and, on 409, `conflict` with "Reload and reapply" that refetches, shows the diff of the user's pending patch, and reapplies on confirm.
- EP-B11 Navigating away (close, next, prev, view change, same-origin links) while a save is pending waits for it; while a save is in `error`, a dialog asks to retry or discard. Guards are registered through the framework's navigation context and scoped to the active panel, so an entity surface embedded in another module guards only itself; an invalid autosaved field (inside a `data-autosave` container) blocks navigation and reports its validity message; secondary forms in the panel do not.
- EP-B12 Optimistic updates apply to the list row and detail; on error they roll back. A row that leaves the loaded list after a mutation (completed, trashed, restored) stays rendered and inert for one 300 ms fade-and-collapse, and a row that arrives into a list already on screen rises in as its mirror. Both are keyed off identity against the previous render and both are skipped when the list is replaced wholesale (view, filter or search change), when it is loading its first page, or when more rows move at once than one event's worth: a screen that redraws entirely is a new screen, not a set of arrivals. Under reduced motion neither runs.

## Lists

- EP-B13 Infinite paging with `fetchNextPage` on scroll; next/prev at the end of the loaded page loads the next page before moving.
- EP-B14 Grouping renders headers with counts over the loaded rows and, when `meta.counts` provides a group count, the full count in parentheses; collapse state per module in local storage. The selected row is marked with the accent-soft ground and a 3 px start-edge bar; while a panel is open the ground is dropped and the bar carries it alone (EP-B23), because the open record already answers which row it is.
- EP-B15 Empty states: no items at all (primary action) versus no matches (clear filters); the module may supply the icon through `emptyState.icon`. While the first page loads the list shows six placeholder rows at row height, and while an item loads the detail shows a placeholder title, property rows and text block.
- EP-B16 Errors: list error panel with retry and request id; detail error inline.
- EP-B17 Focus: opening detail moves focus to the title; closing returns focus to the row; create returns focus to the new row after submit.
- EP-B18 Query client is recreated on login and logout; list refetch on focus and every 60 seconds while visible.
- EP-B24 A change the user caused is acknowledged where it shows. A count that changes is keyed on
  its own value so the new figure replaces the old rather than the element quietly redrawing; this
  covers the rail counts and the statistics strip, and Home states the same rule for its sections.
  A control that appears in place, the bulk action bar when selection starts, arrives rather than
  popping in. The save pill's tick lands the way the completion tick does, so a save reads as an
  event rather than a substitution. None of these is a loop: motion here marks something that
  happened and then stops, and none of it runs under reduced motion.
- EP-B23 Opening a record makes that record the subject of the page, and the page has to say so
  without recolouring anything. Four things carry it. The surrounding surfaces soften for as long
  as the record is open: the dim belongs to the open record, not to where the pointer happens to
  be. Lifting it on hover made it flicker on the way to anything else and cancelled it outright at
  the moment it was for, since a record is opened by clicking a row and the pointer is therefore
  already on the list. Keyboard focus still lifts it, because tabbing into the list is a
  deliberate move away from the record and what is focused has to be readable. The open panel is
  the only raised plane: the list and rail drop to the page
  ground and the panel keeps the surface tone and a tinted shadow, so the separation is read off
  the neutral scale rather than a tint. The selected row gives up its ground and keeps its edge
  bar. The heading the panel focuses on open (EP-B17) shows no focus ring, because it is not
  tabbable and a ring there makes an editable title read as a selected form field; the focus itself
  stays, so the record is still announced. The panel fades as it slides in rather than only sliding.
  Under reduced motion the panel does not slide and the hold releases in one frame instead of
  fading; the hold itself, the surfaces and the row's ground are state rather than motion and
  apply either way.

## Acceptance criteria

- EP-A01 Tasks and Notes render with the framework and contain no page-level implementation of selection, URL state, keyboard, mobile transitions, or auto-save (structure audit: the module `ui/` has no `useSearchParams`, `matchMedia`, `history`). (en)
- EP-A02 `/tasks?view=overdue&id=<uuid>` opens the view and item on desktop and mobile; back returns to the list. (en, ar)
- EP-A03 Keyboard-only walkthrough: list → open → edit title → save → close, with visible focus at each step. (en, ar)
- EP-A04 Two rapid edits produce one or two requests, never out of order; a 409 keeps the draft and offers reapply. (en)
- EP-A05 In Notes, selecting three notes with `x` exposes only note-safe bulk actions (Archive and Add tag); running Archive archives them and Add tag applies one tag to each; no thread, merge, unmerge, stack, or grouping action exists. (en, ar)
- EP-A06 RTL: detail panel on the left, mobile detail slides from the left, arrows move in list order. (ar)

## Required scenarios

- `src/ui/entity/tests/url-state.test.tsx`: B01–B05.
- `keyboard.test.tsx`: B06 including disabled-in-inputs.
- `mobile.test.tsx`: B08, B09.
- `autosave.test.tsx`: B10–B12 with fake timers, overlapping saves, 409 path, navigate-while-pending.
- `list.test.tsx`: B13–B18.
- `row-motion.test.ts`: B12 arrivals and exits, the batch cap, the wholesale replacement and the first load.
- `feedback.test.tsx`: B24 the save tick only once saved, the bulk bar's arrival.

- `row-trail.test.tsx`: B20 the trailing control renders outside the row button, never nested inside it.
- `field.test.tsx`: B19 label, hint, error and invalid associations; first invalid field focused on submit.
- `multiselect.test.tsx`: selection clearing rules, bulk action confirm.
- `bulk-actions.test.tsx`: confirm flow runs once, render escape hatch, disabled predicates.
- `navigation-guard.test.tsx`: registered guard defers, unregistered surface navigates, guards leave with their owner.
- `keyboard.test.ts`: `a` opens bulk actions, `x` toggles, shortcuts ignored in inputs.
- e2e `entity-framework.spec.ts`: A02, A03, A06 in both locales; B23 the dim holds through the click that opened the record, the panel is the only raised plane and the wider column, and the selected row keeps only its edge bar.
- Mutation targets: `resolveUrlState`, `saveQueue`, `keyboardHandler`.

## Audit items

- No module page file exceeds 250 lines.
- The framework has zero imports from `src/modules`.

- EP-B22 Search places its decorative icon and input in separate flex items within a shared focus border, preserving space for Arabic and English text without overlap at narrow widths.

EP-B15 Clear filters resets the search draft as well as the URL, cancelling a pending debounce even before the draft reaches the URL. External query changes rebase the local draft so old text cannot reappear. EP-B22 Clear filters stays within the search action row; its label never overlaps the search field in either direction.

EP-B22 entity pages share the toolbar controller. Card lists show Create above the desktop rail and a compact search/sort/action bar; mobile and collapsed-rail layouts retain the title/view/Create row. Other entity lists retain that header at all widths. Clear filters stays beside search, has an accessible icon-only form in narrow containers, and is invisible when no filters or non-All view are active; its reserved space keeps search width stable. Search retains the explicit view; starting a search before a module default arrives pins All, and a module default must not replace an active search. Delayed URL acknowledgements preserve newer typing. Both Tasks and Notes use these same components and controller.

EP-B14 card lists share lightweight group headings and loaded-row counts in the framework. EP-B07 a view with `featured: "compact"` appears beside the current view in the toolbar instead of the statistics strip; `featured: true` retains the card presentation.

EP-B20 `renderers.rowStyle: "card"` opts into spaced horizontal card containers with rounded borders and responsive trailing metadata; the same row button, selection checkbox, focus/navigation and sibling interactive controls remain in use. Default rows retain their existing layout.

EP-B20 Notes and Tasks both select the shared card presentation. Completion/selection controls remain independent siblings of the opening button; missing trailing content produces no empty footer.

EP-B20 card density is compact: a 56px minimum opening target, flexible title, grouped trailing metadata and an unbordered secondary line only when the container is narrow. EP-B22 sorting is directly accessible beside search; filters and selection remain shared. Empty Clear filters reserves an icon slot without showing inactive text.

EP-B07 featured summaries use rounded bordered cards with an accent selected state. Optional `featuredOrder` controls summary order independently from the views rail. Five summaries use five columns in wide containers; narrow containers use two columns.
