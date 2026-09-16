# Feature: Entity pages (shared list + detail framework)

**Status:** accepted
**Spec reviewed:** 2026-09-16
**Implementation verified:** 2026-09-07 for EP-B01, B03, B05–B11, B13, B15, B17 (People and Tasks); B12, B14, B16, B18 and the acceptance walkthroughs remain open
**Owner module:** `src/ui/entity`

## Purpose

One implementation of list + detail behavior for every module: selection, URL state, keyboard navigation, mobile transitions, multiselect, auto-save, loading, empty and error states. Modules supply data hooks, mutation adapters, and renderers. The framework is built alongside Tasks (Phase 2), validated against Notes' multiselect merge (Phase 3), then frozen.

## Public API

```ts
<EntityPage<TItem, TPatch, TCreate>
  module="tasks"
  title={…} description={…}
  filters={{ views, facets?, sort?: { options, default }, mode? }}  // the framework owns their URL state
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
    rowStyle: 'card' | 'grid',               // default rows are lines; see EP-B20, EP-B27
    row: (item) => …,
    rowTrail: (item) => …,                   // sibling of the row button, so it may hold a control
    detail: (item, api) => …,                // api: save(patch), close, next, prev, neighbors, remove, restore, saveState, retry
    create: (api) => …,                      // api: submit(input), cancel, pending
    name: (item) => string,
    deletedMessage: string,                  // localized "<kind> moved to trash" for the Undo toast (EP-B36)
  }}
/>
```

Twelve top-level props is the ceiling (`07-coding-guidelines.md`); related options are grouped (`filters`, `mutations`, `renderers`). A bulk action either runs directly, after the shared confirm dialog, or renders its own dialog through `render(items, finish)`; `finish(true)` clears the selection, `finish(false)` only closes. No `unknown` or `any` in the public types.

## URL state

`?view=&<facets>&q=&sort=&id=<uuid>&new=1&sel=<ids>`.

- EP-B01 Precedence: `new=1` wins over `id`; opening create removes `id`; opening an item removes `new`. `sel` and the open detail are cleared when `view`, facets, `sort`, or `q` change.
- EP-B02 Push versus replace: open item → push; next/prev → replace; close → push (removes `id`); filter changes → replace. Back returns to the list state before the open.
- EP-B03 Deep link to an `id` not in the current filtered list: the detail still opens (fetched by id) and the list shows a banner "not in current view" with "show in All".
- EP-B37 **Every record closes with the same footer.** `EntityFooter` in `src/ui/entity` is the
  framework's, not each module's: a top rule, the module's own metadata about the record on the
  start side, and on the end side the module's closing actions followed by the one delete control.
  `EntityUpdated` is the line every record can show — relative in the footer, exact on hover. The
  delete control is ghost in the danger ink with the trash icon and reads `common.delete`; it is
  hidden while the record is already in the trash. Modules MUST NOT render their own delete button:
  the framework owned the action (EP-B36) but not its placement, and five modules grew four
  treatments of one action, from a filled destructive button to a bare one with no footer at all.
  Weight is what tells a reader what an action costs now that a reversible delete no longer stops to
  ask, so it cannot vary by module — ghost in danger ink means reversible with Undo behind it, and
  the filled `destructive` variant is reserved for the irreversible actions that do still confirm.
  The ink is not held back until hover, because the office works on tablets and nothing hovers there.
- EP-B36 **Deleting a record is not confirmed.** Soft deletion is reversible, so the shared detail
  panel performs it on the press: the record goes, the panel closes behind it, and an Undo toast
  reports it. The toast reads `renderers.deletedMessage`, which names the kind of record rather than
  the record itself — a title is unbounded and would change the toast's shape every time it appeared,
  and the reader has just acted on that record. Undo calls `mutations.restore(id, opId)` with the
  operation id the deletion returned; it restores the entity and everything else that operation
  removed, never merely delaying the request. A delete that fails leaves the panel open and the
  record where it was, with the error above it. Permanent deletion and purge remain confirmed: those
  are the irreversible ones, and a dialog in front of a reversible action asks at the moment of least
  attention while catching none of the mistake that actually happens, which is acting on the wrong
  record — that one only becomes visible once the record has gone. The mutation adapters return as
  soon as the server has taken the delete; the cache invalidation they trigger is not awaited, so the
  receipt arrives with the disappearance rather than after every dependent query has refetched.
- EP-B04 Deep link to a deleted or missing id: detail shows an inline not-found state with Close; the URL keeps `id` until Close (so reload reproduces the state); Close removes it.
- EP-B05 If the selected row is deleted by the current user, detail closes and focus returns to the next row; if it disappears due to a refetch (another member deleted it), detail shows the not-found state.

## Keyboard

- EP-B06 `↑/↓` (`k/j`) move focus; `Enter` opens; `Esc` closes detail, second `Esc` clears filters, third clears selection; `n` create; `x` toggles checkbox in multi mode; `Shift+↑/↓` extends selection; `a` with selection focuses the bulk action bar. Disabled while an input, textarea, contenteditable, or dialog has focus, except `Esc` in a plain field or on a closed picker, which leaves the field and closes the detail once pending saves settle (B11); an open picker keeps `Esc` for itself. Opening a record takes focus off the row before the panel exists to receive it, so while the record loads the active element is the document body, outside the surface the shortcuts are delegated from; `Esc` is also handled from the document for exactly that case, guarded on this surface having a panel open and on focus being nowhere at all, so it closes the panel instead of doing nothing. The panel bar shows the save state as a pill: a spinner while saving, a tick for two seconds after, a warning until a failed save is retried.

## Layout

- EP-B38 The open record's bar carries a labelled Back at the start edge at every width, and from
  1024 px a close cross at the end edge as well. Both do the same thing, and they say different
  things about it: Back leaves the record, which is the whole screen on a phone and so the only
  control there, while the cross dismisses a surface, which the panel only becomes once it is a
  slide-over over the list. The two names are distinct to assistive technology (`Back`, `Close`) and
  the start edge is logical, so RTL mirrors both without a second rule.
- EP-B07 Desktop (≥ 1024 px): rail 208 px (collapsible, ≥ 1280 px), list, and the detail as a slide-over over the list at `clamp(480px, 46%, 880px)` of the window, running the full height of the viewport flush against its end edge, over the shell header as well as the page (EP-B26). The list keeps the width it had before the record opened: nothing resizes and no row moves under the click that opened it. 480 px stays the floor and 880 px the ceiling because that is the measure a property form reads at; the share is now of what the panel covers rather than of what it displaces. The list column opens with one sticky bar that carries the page title, the current view and its count (a button into the filter sheet where the rail is hidden), search, Filter, selection mode and the primary Create action; the page description is exposed to assistive technology only. Card lists place Create above the desktop views rail and use a compact search/sort/action toolbar; without a visible rail, the title/view and Create remain above it (EP-B22). Rows are 44 px single-line by default; group headers are 28 px; rail items 32 px with a divider before views marked `separated`. Views marked `featured` also show their count in a strip under the bar **where the rail is not showing them already** (EP-B35) (tinted by `tone` when the count is above zero: `accent` and `danger` for the app's own semantics, `good`, `warn` and `bad` for the status scale a scorecard reads in); views may carry an `icon` for the rail. While a panel or the create form is open the shell sidebar, the rail and the list soften with a light blur so only the open record reads sharp, and they stay soft for as long as the record is open (EP-B23). Colours do not change. Keyboard focus is the single exception: focus within one of those surfaces restores it, because tabbing into the list has to leave it readable. The pointer does not, so passing over the list on the way to something else does not flicker it back and forth. The panel bar shows the item's position in the loaded list ("3 of 11") when no save is in flight, as a control: previous and next move through the loaded list from the panel. This reverses the earlier rule that moving between items is done from the list alone. While a record is open the list is covered on its end side and, since EP-B23, stays softened, so sending the reader back to it for the commonest move in triage is the wrong cost. The bar also carries the record's name once the heading has scrolled out of view, so a long record always says which one it is.
- EP-B08 Mobile: views `list` → `detail` → `create`, full screen, slide from the end side (`dir`-aware); rail as a bottom sheet with active-filter count. Back gesture and browser back both go to the previous view.
- EP-B09 Direction: all animation and column order derive from `dir`.
- EP-B27 `renderers.rowStyle: "grid"` lays the rows out as tiles in columns instead of stacked
  containers, for a list whose rows are figures rather than sentences. The column count comes from
  container queries on the list itself — two from `@2xl`, three from `@5xl` — so it answers to the
  width the list actually has and not to the window's, which matters because the slide-over of
  EP-B26 no longer changes that width. Tiles stretch to their track row, so a short record and a
  long one align across it and a column of figures reads as a column. A group heading is its own
  list item spanning every track (EP-B14), which is also why headings are siblings of the rows
  rather than blocks inside the first row of each group. Selection sits over the tile's own corner,
  because a tile has no leading column to give it.
  A grid has two axes, so `↑/↓` move a whole track row and `←/→` move one tile, mirrored by `dir`
  (EP-B09); the track count is read from the list's computed columns, since the container query is
  what decides it. `←/→` are bound only in a grid, so a list of lines leaves them to the browser.
  Tiles arrive as a cascade on the delay step every other entrance in the app is timed from, set by
  position rather than by an index the markup carries, and capped from the seventh so a long list
  does not become a ticker. Rows are keyed by identity, so a refetch returning the same records
  re-renders without replaying it; a new view, filter or reading (EP-B28) is a new screen and does
  replay it. Nothing cascades under reduced motion.
- EP-B35 The list says a thing once. The rail lists every view with its count, and the statistics
  strip re-draws the featured ones bigger forty pixels below it, and the toolbar's summary names the
  current view a third time between them — the same facts three ways inside one screen, costing 85 px
  of a desktop list and 198 px of a phone's. The strip and the summary are what a surface *without* a
  rail gets instead of one, so both appear exactly where the rail does not: below 1280 px, and at any
  width where the reader has collapsed it. Where they do appear the summary says it opens something,
  because it is the only way into the views from there and muted text that silently opens a sheet is
  not an affordance. Nothing is removed from the rail: it is the navigation, and the other two are
  its stand-ins.
- EP-B34 While a record is open the panel covers the end of the list, and everything the bar drew
  under it stayed focusable — Tab walked into controls nobody could see, which is the one thing
  EP-B26's "the list still takes Tab" was not supposed to mean. The bar keeps clear of the panel by
  its width and carries only what fits in the strip that leaves: search and Filter. The rest are
  list-wide settings the reader is not adjusting while working on one record, and they are genuinely
  absent rather than hidden, so there are no phantom tab stops; they come back when the record
  closes. The rows do not move, because EP-B26 promises the list keeps the width it had and only the
  bar can step aside without breaking that.
- EP-B33 A sort is not a filter. It reorders the list and never shortens it, so it is not counted on
  a button that reports how many filters are on, it does not make an empty list "no matches", and the
  filter sheet does not carry a third copy of it beside the bar's control and the table's headers
  (EP-B31). A `filters.mode` is the same: EP-B28 already says it travels with the facets and is not
  one, and counting it was what made choosing a period light up "Filters · 1" and widen the button.
- EP-B40 The bar and the readings above it are measured in rows of a phone, not in pixels of a
  desktop. The featured readings are a single scrolling line below 1024 px (`@lg` on the list
  container), each reading one row of name and figure, and the two-column grid returns with the
  width to hold it: five readings in two columns is three rows and an orphan with a hole beside it,
  which cost 198 px of the 732 px a 390 px phone has for records. The strip's snap positions are
  inset by its own padding, or it rests scrolled by exactly that padding with its leading reading
  cut off. The bar's own padding and the gap between its wrapped lines step down at the same width,
  because three wrapped lines at desktop spacing is a row of records. Measured on a 390 px screen
  with seeded data, this moves the first record of Tasks from 433 px to 284 px and of Notes from
  287 px to 224 px.
- EP-B41 The list's search field names its module. Its placeholder and accessible name are the
  module's own words — "Search tasks", "Search notes" — through a required `searchLabel` on the page
  declaration, so beside the Filter button it reads as text against facets, and beside the workspace
  search one row above it (SEARCH-B11) it reads as a filter on this list rather than a second copy of
  that. The no-matches state says what to do next: Clear filters, and — when a phrase was typed —
  "Search the workspace", which opens the palette already holding that phrase, so a reader whose
  phrase lives in another module does not retype it. The palette's own hand-off back into the list
  is SEARCH-B12.
- EP-B39 No control in the bar sits past the end of the screen. The settings group gives width back
  and wraps like everything else in the bar; it was `shrink-0`, which on a module carrying a period
  as well as a sort (KPIs) measured 509 px inside a 390 px viewport — the sort clipped mid-word and
  Filter and Clear rendered off the end, where nothing could reach them. A wrapped line is the cost
  of keeping every control reachable, and it is the right one: a control the reader cannot press is
  not a saving.
- EP-B32 The bar is one wrapping row, not two fixed ones. The title and the controls are two flex
  items that share a line wherever the list is wide enough to hold both and stack where it is not, so
  a desktop list opens with a 67 px header and a phone still gets the two-row form, without either
  width being written down. The title takes only the width it needs once there is a row to share, so
  the spare goes to the controls rather than to the gap after the heading; below that it grows again,
  which is what holds Create against the end edge of a phone.
- EP-B31 A column that names one of the module's sorts orders by it from its own header, and one
  that does not stays plain text: a header that looks orderable and is not is worse than one that
  never offered. This is the thing a table is expected to do and the sort dropdown could never be —
  its options are named orderings ("Needs attention first"), not the columns in front of the reader,
  and the two never lined up. They remain one control over one piece of URL state, so a table header
  and the dropdown cannot disagree, and the sort survives a switch back to cards. Pressing the column
  already ordering the list returns to the module's default, so the control is its own undo, and
  EP-B14's grouping is suppressed for as long as a sort is chosen either way.
  `aria-sort` reports `other` rather than ascending or descending, which is accurate: these are
  named orders owned by the module and some of them (severity, then name) have no one direction to
  claim. Only sorts the module already implements are offered — a column cannot invent a server
  ordering, and the cursor's tuple is that ordering (`04-api-conventions.md`).
- EP-B30 The surface is read and re-read without being reloaded. Two things made it look otherwise.
  Every piece of this URL — the view, the facets, the sort, the layout, the open record, the
  selection — is read by the client surface and by nothing on the server, so it is written with the
  native history methods rather than through the router. Routing it made each of them a request for
  a route whose output cannot change, which is why opening a record fetched the page again before
  the panel appeared. The methods integrate with the router and with `useSearchParams`, so back and
  forward still move through the states the reader passed. And a list query that changes keeps the
  page it already has while the next one loads: the reader changed which question is being asked of
  the same records, not which records they are looking at, so the rows change where they stand
  instead of the list emptying to a placeholder and filling again. A genuine first load has nothing
  to hold and still shows the placeholder (EP-B15). A record's renderer is still loaded on demand,
  so a list route carries no chart runtime it may never need, but the chunk is fetched once the list
  is on screen rather than when a row is clicked — otherwise the first record opened on a fresh page
  pauses and every one after it is instant, which reads as the page loading once for no reason.
- EP-B29 `renderers.columns` declares the same records as a table, and declaring them is what
  offers the reader the choice: a module with no columns has no toggle. A column carries a `head`,
  a `cell`, and `numeric` — the only styling a module may ask for, because it is the one that means
  something: a column of figures is read down, so it takes tabular figures and sits against the
  column's end edge. Exactly one column is `primary`; it names the record, it is the row header,
  and it carries the control that opens it.
  It is a real `<table>` with a caption, a header row and one row header per record, because that
  is what lets a screen reader say which column a cell belongs to and no arrangement of divs earns
  that back. The whole row opens the record but only one thing in it is focusable: the control in
  the row header, stretched over the row by a pseudo-element. A row of nested buttons is a row the
  keyboard has to walk through cell by cell to get past, and every cell would need a name of its
  own. Controls belonging to the record rather than to opening it — the selection box, the row
  action — sit above that overlay and keep their own hit area. A group heading is a row spanning
  every column (EP-B14).
  The table keeps its own horizontal scroll: columns hold their widths, so an open record covers
  the end of the table rather than reflowing it, which is the whole point of the panel it sits
  under (EP-B26).
  The choice lives in two places on purpose. `?layout=table` is the truth while it says anything,
  so a link opens in the layout it was sent in; local storage remembers the last explicit choice
  per module, so returning to a module tomorrow does not undo it. The URL is not written until the
  reader actually chooses, which keeps the common link short and keeps a remembered preference out
  of every link they share. The remembered value is read through `useSyncExternalStore` rather than
  an effect: local storage is the external store that primitive exists for, it has no value on the
  server, and reading it that way keeps the first client render agreeing with the markup instead of
  correcting it a frame later. Clearing filters does not clear it — that returns the reader to the
  unfiltered list, it does not take away the presentation they chose to read it in.
- EP-B28 `filters.mode` is one reading the whole list is taken under: a segmented control in the
  toolbar whose first option is the default and carries the empty value. It keeps URL state exactly
  as a facet does — same key, same query, same clearing — but it is not a filter and must not be
  presented as one. A filter shortens the list; a mode changes what every row of it says, and
  something that rewrites every figure on the page does not belong behind a button that reports how
  many filters are on. It is a segmented group rather than a select because the options are few,
  fixed and read against each other, and because a record panel that asks the same question asks it
  in this shape, so moving between the list and a record does not change the control.
  Stepping it is not animated. Every arrangement of these records carries marks that draw
  themselves on arrival — a tile's arc, a meter's fill — and anything that captures or remounts the
  body to animate the step replays all of them, which reads as the page loading rather than as the
  same records being read against another period. The figures change where they stand. Motion here
  belongs to records arriving (EP-B27), not to the ones already on screen being restated.

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
- EP-B14 Grouping renders headers with counts over the loaded rows and, when `meta.counts` provides a group count, the full count in parentheses; collapse state per module in local storage. A heading only means something while the list is in the order the grouping describes, so a sort the reader chooses suppresses grouping outright: otherwise the headings repeat down the page marking nothing. The selected row is marked with the accent-soft ground and a 3 px start-edge bar; while a panel is open the ground is dropped and the bar carries it alone (EP-B23), because the open record already answers which row it is.
- EP-B15 Empty states: no items at all (primary action) versus no matches (clear filters, and — when a phrase was typed — "Search the workspace", EP-B41); the module may supply the icon through `emptyState.icon`. While the first page loads the list shows six placeholder rows at row height, and while an item loads the detail shows a placeholder title, property rows and text block.
- EP-B16 Errors: list error panel with retry and request id; detail error inline.
- EP-B17 Focus: opening detail moves focus to the title; closing returns focus to the row; create returns focus to the new row after submit.
- EP-B18 Query client is recreated on login and logout; list refetch on focus and every 60 seconds while visible.
- EP-B25 A detail panel is a record before it is a form. A property renders as a fact and takes
  its control's chrome on hover or focus-within, so the panel reads as something written rather
  than as a page of inputs; the control keeps its shape and hit area, so nothing moves when the
  chrome returns. Where there is no pointer to hover with the chrome stays, because on touch it is
  the only thing saying a value can be changed. A value nobody has set is muted, so the eye
  catches what the record says instead of filtering placeholders out of it. Create forms opt out:
  there the job is to fill the fields in and every one of them should look ready. Both row
  components carry the signal, `Property` for a label beside its value and `Field` for a label
  above one, so every module's detail reads the same way whichever it uses and `Field` keeps
  owning the identifiers EP-B19 requires. One exception earns its chrome back: a picker with
  nothing set still says so in words, but an empty text field has no words at all, so it keeps its
  outline rather than leaving a label standing over a void. A detail's short values put the label
  beside them, which is the shape a record reads in and which halves the height of a panel whose
  fields are mostly unset; long-form fields (a description, a tag list) keep the label above,
  because the value needs the width more than the row needs the alignment. A field's hint and
  error stay under its control either way, so the column the reader scans holds only values.
- EP-B24 A change the user caused is acknowledged where it shows. A count that changes is keyed on
  its own value so the new figure replaces the old rather than the element quietly redrawing; this
  covers the rail counts and the statistics strip, and Home states the same rule for its sections.
  A control that appears in place, the bulk action bar when selection starts, arrives rather than
  popping in. The save pill's tick lands the way the completion tick does, so a save reads as an
  event rather than a substitution. None of these is a loop: motion here marks something that
  happened and then stops, and none of it runs under reduced motion.
- EP-B26 From 1024 px the detail is a slide-over, not a column. It leaves the workspace's flex row
  and is positioned against the window's end edge, running the full height of the viewport and
  flush to it rather than floating inside the gap the rail and the list sit on: a record that
  covers the list is a plane in front of it, and a plane in front of something does not also sit on
  the ground behind it. It is fixed rather than absolute, so it clears the shell header too and an
  open record is one unbroken surface from the top of the window to the bottom. Its corners are
  square and only its inner side carries a border: it meets three sides of the window, and a
  radius there would round a corner that has nothing to be a corner against. The shell's own
  controls are what it covers; they are one Esc away, and the sidebar it does not reach keeps the
  nav reachable the whole time. Only its inner side is an edge, so only that side carries a border and a
  radius, and the shadow it casts is even rather than offset so it falls on the list in both
  directions (EP-B09). The list keeps its full width underneath: opening a record moves no row, and closing one moves none back. The
  panel is deliberately not modal. There is no scrim, nothing behind it is inert, the list still
  scrolls and still takes Tab, and `Esc` closes the record exactly as it did (EP-B06) — a record is
  something the reader works on next to the list, not a door closed on it, and the pairing of the
  two is the whole point of the surface. What separates the planes is the EP-B23 softening plus
  elevation, which is why the shadow is heavier than the one a side-by-side column needed. The
  panel is its own scroll container and contains its overscroll, so reaching its end does not start
  scrolling the list behind it. It enters by travelling its own width in from beyond the
  workspace's clipped edge, mirrored by `dir` (EP-B09); under reduced motion it does not travel at
  all. Mobile is unchanged: below 1024 px the detail is still the full-screen view swap of EP-B08,
  because at that width a slide-over and a full-screen view are the same thing and the back gesture
  already reads the second one correctly.
- EP-B23 Opening a record makes that record the subject of the page, and the page has to say so
  without recolouring anything. Four things carry it. The surrounding surfaces soften for as long
  as the record is open: the dim belongs to the open record, not to where the pointer happens to
  be. Lifting it on hover made it flicker on the way to anything else and cancelled it outright at
  the moment it was for, since a record is opened by clicking a row and the pointer is therefore
  already on the list. Keyboard focus still lifts it, because tabbing into the list is a
  deliberate move away from the record and what is focused has to be readable. The open panel is
  the only raised plane, and since EP-B26 it is literally in front of the list rather than beside
  it: the list and rail drop to the page ground and the panel keeps the surface tone over a
  two-layer shadow, so the separation is read off the neutral scale and off height, never off a
  tint. The selected row gives up its ground and keeps its edge
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
- `grid.test.tsx`: B27 the grid's arrows move by track row and by tile, `←/→` are inert on a list of lines, and a group heading spans every track; B14 a chosen sort suppresses the headings.
- `mode.test.tsx`: B28 the mode reaches the list query under its own key, is cleared with the filters, and is not rendered among them.
- `table.test.tsx`: B31 a column that names a sort orders from its header, toggles back to the default, and reports `aria-sort`; a column without one renders no control. B29 the table is a real table with one row header per record and one focusable control in it, numeric columns take tabular figures and the end edge, a group heading spans every column, and the layout resolves URL over storage without clearing with the filters.
- `field.test.tsx`: B19 label, hint, error and invalid associations; first invalid field focused on submit.
- `multiselect.test.tsx`: selection clearing rules, bulk action confirm.
- `bulk-actions.test.tsx`: confirm flow runs once, render escape hatch, disabled predicates.
- `navigation-guard.test.tsx`: registered guard defers, unregistered surface navigates, guards leave with their owner.
- `keyboard.test.ts`: `a` opens bulk actions, `x` toggles, shortcuts ignored in inputs.
- e2e `entity-framework.spec.ts`: A02, A03, A06 in both locales; B23 the dim holds through the click that opened the record, the panel is the only raised plane, and the selected row keeps only its edge bar; B26 the list keeps its width when a record opens, the panel overlaps it rather than sitting beside it, and the list stays scrollable and tabbable behind it.
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
