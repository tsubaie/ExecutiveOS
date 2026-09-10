# Feature: Home

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/modules/home`

## Purpose

The one screen the principal opens first. It is a set of queries over existing modules, not an AI product: what is next, what is not ready, what is overdue, what is waiting for review.

## Behaviors

- HOME-B01 Sections, each with a count, up to 5 items, and a "View all" link into the module's matching view:
  1. **Next meetings** (next 3 upcoming, with prep status badge for the user's locale)
  2. **Prep not ready** (`meetings?view=needs_prep`)
  3. **Overdue actions** (`tasks?view=today` overdue band, top-level only)
  4. **Due today** (band today)
  5. **Waiting on** (`waiting_on` tasks with owner)
  6. **Pending AI reviews** (pending note refinements, ready briefs without feedback from me, learnings proposals if admin)
  7. **Attention KPIs** (`kpis?view=attention`)
  8. **Initiatives at risk** (`initiatives?view=at_risk`)
  9. **Recent notes** (non-archived notes dated within the last seven days, `notes?view=this_week`; NOTES-B14)
- HOME-B02 Sections for disabled modules or with zero items collapse to a single line; the page never shows an empty box.
- HOME-B03 One aggregated endpoint `GET /home` returns all sections in one round trip; each module exposes a `homeSummary(ctx)` function through its `server` manifest that runs ≤ 2 queries. Every section and item carries its own `href`; the page never composes module URLs.
- HOME-B04 Refetch on focus and every 60 seconds.
- HOME-B05 Greeting uses the user's name and the principal's name when they differ ("Preparing for <principal>").
- HOME-B06 Section ownership is exclusive and checked centrally when the providers are collected: a key claimed by two modules, or a key no section list declares, fails the request with the owning key named. Collapsing to the first match would make the page depend on module import order and let a section disappear silently.

## Acceptance criteria

- HOME-A01 With seed data, Home shows the today meeting with its prep status, overdue actions, and the at-risk initiative; every "View all" opens the module in the matching view. (en, ar)
- HOME-A02 `GET /home` completes in ≤ 12 queries with seed data. (en)
- HOME-A03 With AI disabled the Pending AI reviews section is absent. (en)

## Required scenarios

- api: `/home` shape; query counter; disabled modules; duplicate and unknown section ownership (B06).
- ui: collapse rules; links.
- e2e `home.spec.ts`: A01–A03.
- Mutation targets: `homeSummary` aggregators for tasks and meetings.
