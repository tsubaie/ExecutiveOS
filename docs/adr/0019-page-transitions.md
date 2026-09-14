# ADR 0019 — Page transitions with React's `<ViewTransition>`

**Status:** accepted (2026-09-14)

## Context

Every route change in the app replaced the screen instantly, and so did every `loading.tsx`
boundary resolving. The skeletons are deliberately shaped to match the finished layout, and an
instant swap throws that work away: the shape never resolves into the content, it is cut to it,
which reads as a flicker rather than as arrival.

The app already has a motion vocabulary for things that arrive (`--ease-rise`, `--step-rise`,
`rise`, `docs/05 § Motion`), but it stopped at the boundary of a single screen. Nothing covered the
moment one screen is replaced by another, which is the most frequent visual event in the product.

Next 16 supports React's `<ViewTransition>` in the App Router with no configuration
(`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Route navigations are React
transitions, so the component activates on them, and it also activates on Suspense reveals. The
browser's View Transitions API does the capture and interpolation; where it is unsupported the
swap is the instant one the app has always had.

## Decision

- Page-level transitions use React's `<ViewTransition>`, wrapped once in
  `src/ui/layout/PageTransition.tsx` as `PageBody` (page content) and `PagePlaceholder` (the
  `loading.tsx` fallback). Pages import the wrapper; they never import `ViewTransition` directly,
  so the animation names live in one file.
- One pair of names, `page-in` and `page-out`, covers both moments: a route change runs the
  outgoing page's exit against the incoming page's enter, and a Suspense boundary resolving runs
  the placeholder's exit against the content's enter. They are the same handoff.
- The transition is a crossfade with a short rise, not a directional slide. The app's destinations
  are siblings in one nav, not a hierarchy, so "forward" and "back" have nothing to refer to. This
  also removes the RTL mirror a horizontal slide would need (`docs/05 § Internationalization`).
- Every wrapper carries `default="none"` so a page animates only during its own transition, and
  the root group is silenced in CSS, because the shell persists across a navigation and must stay
  the reader's fixed anchor.
- The keyframes live in `src/ui/tokens.css` with the rest of the app's motion and are reduced to
  1 ms under `prefers-reduced-motion: reduce`.
- `@types/react` tracks stable React and does not declare `ViewTransition` yet, while the App
  Router resolves `react` to the canary Next bundles (verified: the component renders and
  `document.startViewTransition` fires on navigation). The gap is closed by a module augmentation
  in `src/types/react-view-transition.d.ts` rather than by moving the project onto a canary React
  or casting at each use.

## Consequences

- No new dependency: `<ViewTransition>` comes from the React that Next already ships.
- Every route's `page.tsx` under `(app)` carries the wrapper. Layouts cannot, because they persist
  across navigation and their enter and exit never fire.
- The type augmentation is temporary. When `@types/react` declares the component, delete
  `src/types/react-view-transition.d.ts`; nothing else changes.
- Browsers without the View Transitions API get the previous instant swap, so this needs no
  feature test and no fallback path.
- A future shared-element morph (a row morphing into the record it opens) is available through the
  same component with a `name` pair, and would supersede the relevant part of this decision.

## Alternatives considered

- **A CSS-only `@view-transition { navigation: auto }` rule.** That is the cross-document
  (multi-page) form; the App Router navigates in-document, so it never fires.
- **Animating in the layout instead of per page.** Layouts persist across navigation, so their
  enter and exit never run. The Next guide says this explicitly.
- **Directional slides keyed off `transitionTypes`.** Correct for a drill-down hierarchy, wrong for
  a flat nav, and it would need a mirrored pair of animations for RTL.
- **A motion library.** Motion or GSAP would mean a new dependency and manual mount and unmount
  tracking to do worse what the browser already does natively.
