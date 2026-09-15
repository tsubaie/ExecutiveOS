import { ViewTransition, type ReactNode } from 'react';
// ADR 0019: one pair of names covers both moments where a screen is replaced. A route change runs
// the outgoing page's exit against the incoming page's enter; a Suspense boundary resolving runs
// the placeholder's exit against the real content's enter. Both are the same handoff, so both use
// the same animation and the app has one page-level transition rather than two.
//
// `default="none"` keeps a page from animating during transitions that are not its own. Without
// browser support for view transitions nothing animates and the swap is the instant one the app
// has always had, which is why this needs no feature test.
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
// The placeholder half: it only ever leaves, because it is never what a navigation arrives at.
export function PagePlaceholder({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}

// ADR 0021: stepping the reading a surface is taken under — the scorecard's comparison period
// (KPIS-B26), the record's own (KPIS-B08). This is the same place showing different content, not a
// new screen, so the old and new are captured and cross-faded rather than one being mounted over
// the other: a remount jolts the container sideways and replays every entrance the content has of
// its own, which is two animations for one event.
//
// It keeps a small directional offset even so. The tab case the Next guide describes has no order
// to encode, but previous and next do, and a reader who has just pressed one of them is told which
// way the figures moved. `key` is what makes React treat the two as an exit/enter pair instead of
// an in-place update, and `default="none"` keeps the surface out of every other transition —
// a route change must not animate this as well.
export function StepBody({
  step,
  transition,
  children,
}: {
  step: string | number;
  transition: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition key={step} enter={transition} exit={transition} default="none">
      {children}
    </ViewTransition>
  );
}
