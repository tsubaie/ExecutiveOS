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
- HOME-B07 The page opens on the day ahead: the workspace date, then how much needs the principal
  today. It never opens on how far behind they are. Leading with the overdue count turns the first
  thing they read every morning into a reprimand, and on a clear day it makes a headline out of
  nothing being wrong; the lateness warning belongs in the overdue block, where it is already
  unmissable. The first section carrying anything leads at full width on a raised surface, the only
  block given one. Below it the sections are not equals: what the principal is accountable for
  carries the wide column, and reference material (recent notes) sits quieter and narrower beside
  it. Overdue is the only state that uses the danger token, and only above zero.
- HOME-B09 Sections that aggregate say how the pile is shaped, not only how big it is. The overdue
  section reports how much of it is a month or more past due, which separates a backlog from a mess,
  and each committee row shows how far along it is as a fixed-width meter with its fraction beside it,
  the same compact form the rest of the row's facts use. Marks are one accent fill over a neutral
  track, measured rather than chosen: accent against danger is indistinguishable under protanopia in
  the light theme, warning against danger fails even for normal vision, and a mid-grey against danger
  fails in the dark theme, so none of those may carry meaning. The track falls under 3:1 against the
  surface, so every meter ships with its figures in text and is hidden from assistive technology; the
  numbers inform and the mark only paces them. A section with nothing aged shows no mark at all,
  because an undivided bar carries no information. Both marks are neutral mass plus a danger portion: accent against danger is
  indistinguishable under protanopia in the light theme and warning against danger is indistinguishable
  even with normal vision, so neither may carry meaning. The neutral falls under 3:1 against the
  surface, so every mark ships with its figures in text and is hidden from assistive technology; the
  numbers carry the information and the mark only ranks it.
- HOME-B10 Waiting on is a chase list, not a task list: one row per person holding the principal's
  work, the heaviest holders first, each opening that person's waiting tasks. Who to chase is the
  action; which individual task they hold is detail that belongs on the task list.
- HOME-B08 A task the principal can finish is finished here. Overdue and due-today rows carry the
  same completion control as the task lists, including the confirmation when the task still has open
  subtasks, so the page is somewhere work gets done rather than only a set of links out. Completion
  refreshes the page's own counts. Rows the principal cannot act on directly carry no control.
- HOME-B03 One aggregated endpoint `GET /home` returns all sections in one round trip; each module exposes a `homeSummary(ctx)` function through its `server` manifest that runs ≤ 2 queries. Every section and item carries its own `href`; the page never composes module URLs.
- HOME-B04 Refetch on focus and every 60 seconds.
- HOME-B05 Greeting uses the user's name and the principal's name when they differ ("Preparing for <principal>").
- HOME-B06 Section ownership is exclusive and checked centrally when the providers are collected: a key claimed by two modules, or a key no section list declares, fails the request with the owning key named. Collapsing to the first match would make the page depend on module import order and let a section disappear silently.

## Known gap

The two sections an executive orients a day around, **Next meetings** and **Prep not ready**, have no
provider: the meetings module does not exist yet, so HOME-B02 omits them and the page cannot yet answer
"what does today look like". Until that module ships this screen is an obligations list, not a day view,
and no amount of layout work changes that. The remaining sections are built around what exists.

## Acceptance criteria

- HOME-A01 With seed data, Home shows the today meeting with its prep status, overdue actions, and the at-risk initiative; every "View all" opens the module in the matching view. (en, ar)
- HOME-A02 `GET /home` completes in ≤ 12 queries with seed data. (en)
- HOME-A03 With AI disabled the Pending AI reviews section is absent. (en)
- HOME-A04 A committee carrying an open task appears under Committees with open work, and its "View all"
  opens Committees in the open view. (en, ar)
- HOME-A05 An overdue row states how many days late it is, a waiting row names the person holding it, and a
  committee row states how much open work it carries. (en, ar)
- HOME-A06 Completing a due-today row from Home removes it and lowers the day's count without a reload. (en)
- HOME-A07 Waiting on shows one row per holder with their count, and a committee carrying late work shows that share. (en, ar)

## Required scenarios

- api: `/home` shape; query counter; disabled modules; duplicate and unknown section ownership (B06).
- ui: omission of uninstalled sections; zero-item sections kept; empty state; links; headline states the day
  and not the deficit; lead selection; section ranking; per-section status fact; completion control only on
  task rows; chase-list aggregation; ageing split; skeleton holds the layout.
- e2e `home.spec.ts`: A01–A03.
- Mutation targets: `homeSummary` aggregators for tasks and meetings.
