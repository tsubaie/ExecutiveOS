# Feature: Home

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/modules/home`

## Purpose

The one screen the principal opens first. It is a set of queries over existing modules, not an AI product: what is next, what is not ready, what is overdue, what is waiting for review.

## Behaviors

- HOME-B01 Sections, each with a count, up to 5 items, and a "View all" link into the module's matching view.
  Every item carries the facts the principal triages on, supplied by the owning module so the page never
  re-queries: the date it turns on (due date, note date), the person holding it, the committee it belongs to,
  and how much open work it represents. A row shows one status fact chosen by the question its section
  answers (how late, who holds it, how much is open, when it happened) plus the committee. The sections:
  1. **Next meetings** (next 3 upcoming, with prep status badge for the user's locale)
  2. **Prep not ready** (`meetings?view=needs_prep`)
  3. **Overdue actions** (`tasks?view=today` overdue band, top-level only)
  4. **Due today** (band today)
  5. **Waiting on** (`waiting_on` tasks with owner)
  6. **Committees with open work** (active committees carrying open top-level tasks, busiest first, `committees?view=open`)
  7. **Pending AI reviews** (pending note refinements, ready briefs without feedback from me, learnings proposals if admin)
  8. **Attention KPIs** (`kpis?view=attention`)
  9. **Initiatives at risk** (`initiatives?view=at_risk`)
  10. **Recent notes** (non-archived notes dated within the last seven days, `notes?view=this_week`; NOTES-B14)
- HOME-B02 A section whose module is not installed is omitted from the page entirely: an absent module is
  an administration fact, not something the principal acts on, and a list of "not enabled" rows crowds out
  the live ones. An installed section stays visible at zero items, collapsed to its single heading line,
  because zero overdue actions is an answer. When no section is installed the page shows one empty state
  pointing at Administration rather than an empty box.
- HOME-B07 The page opens with the workspace date, because "overdue" and "due today" only mean something
  against it, then one band of counts across every installed section plus the people directory. The first
  section carrying anything leads at full width; the rest follow in two columns. The section order is the
  product's urgency order, so the lead is whatever is most pressing that day. Overdue is the only state that
  uses the danger token, and only when its count is above zero.
- HOME-B03 One aggregated endpoint `GET /home` returns all sections in one round trip; each module exposes a `homeSummary(ctx)` function through its `server` manifest that runs ≤ 2 queries. Every section and item carries its own `href`; the page never composes module URLs.
- HOME-B04 Refetch on focus and every 60 seconds.
- HOME-B05 Greeting uses the user's name and the principal's name when they differ ("Preparing for <principal>").
- HOME-B06 Section ownership is exclusive and checked centrally when the providers are collected: a key claimed by two modules, or a key no section list declares, fails the request with the owning key named. Collapsing to the first match would make the page depend on module import order and let a section disappear silently.

## Acceptance criteria

- HOME-A01 With seed data, Home shows the today meeting with its prep status, overdue actions, and the at-risk initiative; every "View all" opens the module in the matching view. (en, ar)
- HOME-A02 `GET /home` completes in ≤ 12 queries with seed data. (en)
- HOME-A03 With AI disabled the Pending AI reviews section is absent. (en)
- HOME-A04 A committee carrying an open task appears under Committees with open work, and its "View all"
  opens Committees in the open view. (en, ar)
- HOME-A05 An overdue row states how many days late it is, a waiting row names the person holding it, and a
  committee row states how much open work it carries. (en, ar)

## Required scenarios

- api: `/home` shape; query counter; disabled modules; duplicate and unknown section ownership (B06).
- ui: omission of uninstalled sections; zero-item sections kept; empty state; links; stat band covers every
  installed section; lead selection; per-section status fact; skeleton holds the layout.
- e2e `home.spec.ts`: A01–A03.
- Mutation targets: `homeSummary` aggregators for tasks and meetings.
