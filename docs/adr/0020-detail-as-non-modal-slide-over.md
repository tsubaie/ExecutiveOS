# ADR 0020 — The entity detail is a non-modal slide-over

**Status:** accepted (2026-09-15)

## Context

Since the entity framework was built, opening a record on desktop inserted a third column into the
workspace: rail, list, detail, all flex siblings. The detail took `clamp(480px, 46%, 880px)` and
the list took whatever was left.

That has one cost the framework kept paying. The list resizes every time a record opens or closes.
Every row reflows under the pointer that just clicked one, column widths inside the rows change,
truncation points move, and a row the reader was about to click next is somewhere else by the time
the panel has arrived. Triage — open, read, act, close, open the next — is the surface's main use,
and it is exactly the loop that pays for the reflow twice per record.

EP-B23 had already moved the design away from the column reading. It softens the rail and the list
while a record is open, drops them to the page ground, and leaves the panel as the only raised
plane. That is the vocabulary of something in front, described in terms of something beside. The
layout was the last part still arguing the other way, and EP-B07's "the record carries the wider of
the two columns" only held because the panel was displacing the list to get that width.

## Decision

- From 1024 px the detail leaves the flex row and is fixed against the window's end edge, running
  the full height of the viewport and flush to it rather than floating inside the gap the rail and
  the list sit on. A plane in front of the list should not also sit on the ground behind it, so
  only its inner side is an edge and only that side carries a border. The corners stay square:
  the panel meets three sides of the window, and the rounding the rail and the list use is what
  says they float on a ground, which is exactly what this no longer does. Being fixed, it
  clears the shell header as well as the page: an open record is one unbroken surface from the top
  of the window to the bottom, which is the whole claim the panel is making. It keeps
  `clamp(480px, 46%, 880px)`, now read against the viewport rather than the workspace, which is
  the measure a property form reads at. The list keeps its full width underneath and no row moves
  when a record opens or closes.
- **The panel is not modal.** There is no scrim, nothing behind it is made inert, the list keeps
  its scroll and its tab order, and clicking a row behind the panel opens that record. The reader
  works on a record *next to* its list, and the framework's own keyboard model (EP-B06 `↑/↓` through
  the list, `Esc` to close) assumes the list is still live. A focus trap would have to be argued
  against every one of those behaviors.
- Separation between the planes comes from the EP-B23 softening plus elevation, so the shadow is a
  two-layer `--shadow-slideover` (a tight layer for contact, a wide one for height) rather than
  the single `--shadow-panel` a side-by-side surface needed. Both layers are cast evenly rather
  than downwards: at full height the edge that has to separate from the rows is the vertical one,
  and an offset shadow would need an RTL mirror to keep falling on the list. No colour changes, so
  contrast inside either surface is untouched.
- The panel contains its own overscroll, so reaching its end does not start scrolling the list
  behind it.
- It enters by travelling its own width in from beyond the workspace's clipped end edge, mirrored
  by `dir`. One keyframe drives both the desktop travel and the phone's nudge through a
  `--panel-slide` variable, so direction and distance stay single declarations.
- **Mobile is unchanged.** Below 1024 px the detail is still EP-B08's full-screen view swap. At
  390 px a slide-over and a full-screen view are the same rectangle, and the view swap is the one
  the back gesture already reads correctly.

## Consequences

- Opening and closing a record is now free of list reflow, which is the point.
- The panel covers the end side of the list. Rows remain reachable by scrolling, by keyboard, and
  by closing the record, and the panel's own previous/next control (EP-B07) already covers the move
  the covered rows would otherwise be needed for.
- It also covers the end of the shell header, so the workspace name, the preferences menu and
  logout are behind an open record. They are one `Esc` away, and the sidebar the panel never
  reaches keeps the whole nav live, so nothing becomes unreachable — but a full-height panel and
  a persistent header are genuinely exclusive, and this chooses the panel.
- Fixed positioning is only safe while no ancestor of the panel establishes a containing block
  (`transform`, `filter`, `contain`, `will-change`). The EP-B23 softening deliberately applies to
  the sidebar, the rail and the list — all siblings of the panel, never its ancestors — and the
  page-transition wrapper of ADR 0019 names elements only while a navigation is running.
- EP-B07 and EP-B23 are amended in `features/entity-pages.md`; EP-B26 records the new behavior. The
  e2e assertion that the panel is the wider of two columns is replaced by one that the list keeps
  its width and the panel overlaps it.
- Every module gets this at once — the change is entirely inside `src/ui/entity` and
  `src/ui/tokens.css`, and no module renderer knows which layout it is rendering into.
- The non-modal choice means a record can be left open while the reader works in the list. That is
  intended, and the save queue (EP-B10) and navigation guards (EP-B11) already cover what happens
  when they then move away with an edit pending.

## Alternatives considered

- **A modal slide-over with a scrim and a focus trap** — the common pattern, and wrong here. It
  contradicts EP-B06's list-level keyboard navigation, makes the panel's own previous/next control
  the *only* way to move between records, and puts a dimming layer between the reader and the list
  they are triaging against.
- **Keeping the inline column.** Rejected for the reflow above; it is also the only part of the
  surface still describing the panel as a peer of the list rather than as the subject of the page.
- **A resizable split with a drag handle.** More layout to persist per module and per user, and it
  answers a question ("how wide?") the clamp already answers well enough.
- **A bottom sheet on desktop.** Wastes the axis the content actually needs; a record is a tall,
  narrow form.
- **Making mobile use the same overlay.** One code path, but it would rewrite EP-B08's back-gesture
  behavior to gain nothing visible at 390 px.
