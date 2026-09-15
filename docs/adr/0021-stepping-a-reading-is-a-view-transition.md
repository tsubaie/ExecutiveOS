# ADR 0021 — Stepping the reading a surface is taken under is a view transition

**Status:** accepted (2026-09-15)

## Context

The scorecard's comparison period in the list toolbar (EP-B28, KPIS-B26) steps the whole list
through ordered readings of the same records: every figure on screen is rewritten and not one
record is added or removed.

The first attempt animated them by remounting the content under a changed `key` and running a CSS
entrance on the new element. That is wrong twice over. Nothing captures the outgoing content, so
the old figures vanish and the new ones slide in over the gap — the container appears to jolt
sideways rather than the content being replaced. And a remount replays every entrance the content
owns, so a period step ran the grid's arrival cascade (EP-B27) and the arc's draw underneath the
slide: two animations for one event.

ADR 0019 already put `<ViewTransition>` behind `src/ui/layout/PageTransition.tsx` for the moment
one screen replaces another, and anticipated this: "a future shared-element morph is available
through the same component with a name pair, and would supersede the relevant part of this
decision."

Next's own guide (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`) separates the
cases: a directional slide says "going to a new place"; a crossfade says "same place, different
content". A period step is the second. It also notes what actually triggers one — a React
Transition, a Suspense reveal or `useDeferredValue`; a plain `setState` does not.

## Decision

- Stepping a reading goes through `StepBody` in `PageTransition.tsx`, a third wrapper beside
  `PageBody` and `PagePlaceholder`. Nothing imports `ViewTransition` directly (ADR 0019).
- `key` is the step index, which is what makes React treat the old and new content as an exit and
  enter pair rather than an in-place update, so the browser captures both and animates between them.
  Nothing is remounted, so no entrance belonging to the content replays underneath.
- The animation is a crossfade carrying a **1.5 rem** directional offset, not a full slide. The tab
  case the guide describes has no order to encode; previous and next do, and a reader who has just
  pressed one should be told which way the figures moved. The offset is small enough that the
  surface still reads as restating itself rather than as a new screen arriving. The old leaves
  faster than the new arrives, so the two never overlap into a smear.
- Direction comes from `useStepMotion` in `src/ui/motion.ts`, which reports only forward or back;
  it is derived during render because the direction has to be known in the commit the browser
  captures. The offset is a CSS variable, mirrored under `[dir='rtl']` (EP-B09).
- `default="none"` on the wrapper keeps the surface out of every other transition, so a route change
  animates the page and not this as well.
- **The record's own period toggle (KPIS-B08) is excluded.** It was wrapped the same way first and
  had to come out: capturing that block tears the gauge down and stands a new one up, and a chart
  that re-mounts reads as a chart that is loading — the one thing a reader must not think when they
  have only asked to compare a quarter. The arc animates between the two values in place instead,
  which is the movement that actually means something there: the mark travelling from one reading
  to the other. A transition is right for a list of records restating itself and wrong for a single
  instrument being re-read.
- The list's control navigates, and a Next navigation is already a React Transition, so nothing has
  to opt in. A surface driven by plain state would need `startTransition` to trigger one at all.
- Under reduced motion both halves collapse to 1 ms, the way ADR 0019's page transition does.

## Consequences

- One event, one animation. The grid cascade and the arc draw now run when content genuinely
  arrives — a first load, a new view — and not when the same records are restated.
- Browsers without the View Transitions API get the instant swap they always had; no feature test.
- Any future ordered control gets this by passing a step and a direction, with no CSS of its own.
- `StepBody` and `PageBody` must not wrap the same element: two named transitions on one node would
  compete for the same capture.
- Anything holding a chart, a canvas or a media element should stay outside a captured block, for
  the reason the record's gauge does. Where the content is one instrument rather than a set of
  records, animate the instrument's own values and leave the container alone.

## Alternatives considered

- **A crossfade with no offset**, as the guide's tab example uses. Correct for tabs, and it throws
  away the one thing a previous/next control has that tabs do not.
- **A full-width slide.** Claims a new screen arrived, and at list width it is a large horizontal
  movement for what is a restatement of the same seven records.
- **Keeping the remount and suppressing the cascade underneath it.** Fixes the second fault and not
  the first: without a capture of the outgoing content there is nothing to animate away from.
- **A motion library.** A new dependency to do worse what the browser does natively, and ADR 0019
  already rejected it for the same reason.
