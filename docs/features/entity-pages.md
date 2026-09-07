# Feature: Entity pages (shared list + detail framework)

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/ui/entity`

## Purpose

One implementation of list + detail behavior for every module: selection, URL state, keyboard navigation, mobile transitions, multiselect, auto-save, loading, empty and error states. Modules supply data hooks, mutation adapters, and renderers. The framework is built alongside Tasks (Phase 2), validated against Notes' multiselect merge (Phase 3), then frozen.

## Public API

```ts
<EntityPage<TItem, TDetail, TFilters, TPatch, TCreate>
  module="tasks"
  filters={filtersDef}                       // views, facets, search
  useList={useTaskList}                      // (filters) => ListResult<TItem>
  useDetail={useTaskDetail}                  // (id) => DetailResult<TDetail>
  mutations={{                               // adapters; each returns a promise and throws AppError
    patch: (id, revision, patch: TPatch) => Promise<TDetail>,
    create: (input: TCreate) => Promise<TDetail>,
    remove: (id, revision) => Promise<{ opId }>,
    restore: (id, opId) => Promise<TDetail>,
  }}
  selection="single" | "multi"               // multi enables checkboxes and a bulk action bar
  bulkActions={[{ id, label, run: (ids) => Promise<void>, confirm?: … }]}
  renderRow={(item, s) => …}                 // s: selected, focused, checked
  renderCard={(item, s) => …}
  renderDetail={(detail, api) => …}          // api: save(patch), close, next, prev, remove, restore, saveState
  renderCreate={(api) => …}                  // api: submit(input), cancel, pending
  groupBy={grouping}                         // optional
  emptyState={{ title, description, action }}
  shortcuts={extra}
/>
```

No `unknown` or `any` in the public types.

## URL state

`?view=&<facets>&q=&sort=&id=<uuid>&new=1&sel=<ids>`.

- EP-B01 Precedence: `new=1` wins over `id`; opening create removes `id`; opening an item removes `new`. `sel` is cleared when `view`, facets, or `q` change.
- EP-B02 Push versus replace: open item → push; next/prev → replace; close → push (removes `id`); filter changes → replace. Back returns to the list state before the open.
- EP-B03 Deep link to an `id` not in the current filtered list: the detail still opens (fetched by id) and the list shows a banner "not in current view" with "show in All".
- EP-B04 Deep link to a deleted or missing id: detail shows an inline not-found state with Close; the URL keeps `id` until Close (so reload reproduces the state); Close removes it.
- EP-B05 If the selected row is deleted by the current user, detail closes and focus returns to the next row; if it disappears due to a refetch (another member deleted it), detail shows the not-found state.

## Keyboard

- EP-B06 `↑/↓` (`k/j`) move focus; `Enter` opens; `Esc` closes detail, second `Esc` clears filters, third clears selection; `n` create; `x` toggles checkbox in multi mode; `Shift+↑/↓` extends selection; `a` with selection opens bulk actions. Disabled while an input, textarea, or contenteditable has focus.

## Layout

- EP-B07 Desktop (≥ 1024 px): rail 240 px (collapsible), list, detail 480 px inline; list resizes, never shifts.
- EP-B08 Mobile: views `list` → `detail` → `create`, full screen, slide from the end side (`dir`-aware); rail as a bottom sheet with active-filter count. Back gesture and browser back both go to the previous view.
- EP-B09 Direction: all animation and column order derive from `dir`.

## Auto-save

- EP-B10 `api.save(patch)` queues per entity: one request in flight; newer patches coalesce; each request sends the latest known `revision`. State `idle → saving → saved (2 s) → idle`, or `error` with Retry (same idempotency key) and, on 409, `conflict` with "Reload and reapply" that refetches, shows the diff of the user's pending patch, and reapplies on confirm.
- EP-B11 Navigating away (close, next, prev, view change) while a save is pending waits for it; while a save is in `error`, a dialog asks to retry or discard.
- EP-B12 Optimistic updates apply to the list row and detail; on error they roll back.

## Lists

- EP-B13 Infinite paging with `fetchNextPage` on scroll; next/prev at the end of the loaded page loads the next page before moving.
- EP-B14 Grouping renders headers with counts over the loaded rows and, when `meta.counts` provides a group count, the full count in parentheses; collapse state per module in local storage.
- EP-B15 Empty states: no items at all (primary action) versus no matches (clear filters).
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
- e2e `entity-framework.spec.ts`: A02, A03, A06 in both locales.
- Mutation targets: `resolveUrlState`, `saveQueue`, `keyboardHandler`.

## Audit items

- No module page file exceeds 250 lines.
- The framework has zero imports from `src/modules`.
