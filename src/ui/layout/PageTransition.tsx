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

