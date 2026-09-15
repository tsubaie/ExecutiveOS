# ADR 0023 — The route bundle budget is 272 KB

**Status:** accepted (2026-09-15)

## Context

`audit:bundle` caps route-specific client JavaScript — the chunks a route reaches beyond the root
bundle every route already loads — at 250 KB gzipped on the production build. The number was set
when the shell header carried a workspace name and two preference toggles, so a route's total was
almost entirely its own page.

ADR 0021 and ADR 0022 put three workspace-wide surfaces in that header: the search palette, the
notification centre and the account menu. They are shell, not page, so every route can reach them,
and every route's measured total grew by roughly 5 KB. That pushed `/(app)/people/page` from about
250 KB to 255 KB — over a budget it had been sitting exactly on.

Two facts decided what to do about it.

**The metric counts reachability, not loading.** `collectBundle` reads each route's client
reference manifest and sums every chunk in it that is not in the root bundle. A `lazy()` boundary
therefore changes nothing: the palette, the notification list and the account panel are all fetched
on first open, which is the right behaviour for a reader on a slow connection, and all three still
count against every route. Code-splitting is not available as a way to meet this number.

**The largest single chunk on the route is not the route's.** `/(app)/people/page` reaches 22
chunks totalling 255 KB, of which 83.5 KB is vendor Zod. That is a third of the budget spent before
any of People's own code, and it is shared by every module's validation schemas without being in
the root bundle that `audit:bundle` subtracts.

The alternative to a new number was to trim People's graph, which means moving validation schemas
out of a route that legitimately uses them — real work, with its own measurement, and unrelated to
the header.

## Decision

- **The route budget is 272 KB gzipped**, up from 250 KB. The figure is the current worst route
  (255 KB) plus about 6% of headroom, so it is a budget rather than a snapshot of today: a route
  can absorb another shell-wide feature before the gate fires, and the gate still fires well before
  a route doubles.
- **The root bundle warning is unchanged.** `audit:bundle` continues to report the shared bundle
  size on every run without a threshold, because that number is the one every route pays
  unconditionally and it should stay visible.
- **This is not a licence to grow.** The next route to approach the budget is a signal to reduce
  the graph, not to raise the number again. Specifically, the vendor Zod chunk is the standing
  candidate: it is a third of the worst route and it is reached, not used, by most of what reaches
  it.

## Consequences

- `scripts/audit/bundle.ts` and `09-audit-checklists.md` carry 272 KB. `audit:bundle` passes on
  `main` and on this branch.
- Every route now measures about 5 KB higher than it did, permanently, because the header is
  reachable from all of them. That is the price of a workspace-wide search, notification centre and
  account menu, and it is paid once rather than per route.
- The lazy boundaries introduced with the header stay, even though they do not help this metric.
  They are what keeps a reader who never opens the palette from downloading it.
- A future ADR that moves validation schemas out of route graphs could lower this number again. The
  budget being higher does not make that work less worth doing.

## Alternatives considered

- **Leaving the budget at 250 KB and trimming People.** The honest fix for People specifically, and
  the one this ADR defers rather than rejects. It was not done here because the overage is caused by
  the shell, not by People, and fixing one route leaves every other route 5 KB closer to a limit
  that no longer matches what a route contains.
- **Excluding the shell from the per-route measurement.** It would model the cost correctly — the
  header is loaded once and cached — but it requires the audit to know which client modules are
  shell, which is exactly the kind of exception that makes a gate stop meaning anything.
- **Dropping a header feature.** The features were specified deliberately (`05-ui-guidelines.md`
  § Layout shell); 5 KB is not a reason to remove one.
- **Setting the budget at 256 KB**, the smallest number that passes. Rejected: a budget tuned to
  today's worst route fires on the next commit and teaches the team to raise it again.
