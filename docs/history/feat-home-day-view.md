# Hand-off: home — the week leads, the task sections merge, the rows say more

Status: complete

## Summary

Home was a stack of equal sections whose raised lead was whichever one happened to carry
something: Overdue actions on a bad morning, Attention KPIs on a quiet one. The lead is now fixed
and it is the week, drawn as a timeline — what is already late before the line of now, then today
and the six days after it as dated columns, each saying in words how much lands on it — because an
executive orients on time, and it is the part of a day view the tasks module can feed before
Meetings exists. Two drafts of that strip were rejected on the maintainer's review and are recorded
in the spec: tiles with headline-sized day numbers read as a scorecard, and one mark per task under
each date said the count twice. Each day is also somewhere to go: it opens the task list narrowed
to that day. That needed two things outside Home, both small — a `due` facet on the Tasks list
(TASKS-B05, one calendar day, alongside the existing range) and a date kind of facet in the entity
framework (EP-B42), because the framework only read fixed-list choices from the URL — and the
tasks provider hands each day its href, so Home still composes no URL (HOME-B03). Under it the sections sit in one grid of three
columns in the order the principal asks: what must I do, who do I chase, what moved. Overdue
actions and Due today, which answer one question and are one view in Tasks, are drawn as one
Actions block with two bands. A KPI row now carries the scorecard's arc, its share of the target
and its state word, and no longer repeats the objective the scorecard already groups by; a waiting row is dated by the earliest thing
its holder has due and says how much of it is already late, and waiting work that nobody holds —
which the old owner-required rule hid, two tasks in the preview workspace — is one last "No one
assigned" row with the same facts. The headline no longer describes an empty day as clear in
Arabic, the Arabic strings count tasks (مهمة) rather than items (بند), and the directory link sits
at the far edge of its line instead of beside the greeting.

The payload keeps every section it had; the tasks provider adds the week's shape to the due-today
section, the earliest due date and late share to each holder and the unassigned row, and the KPI
provider adds the state word and the proportion to each row. No new query anywhere: each provider
still answers in one. The tasks provider moved out of `service.ts`, which was at the 400-line
limit, into `home.ts`, the way `search.ts` holds the search provider; the module manifest table in
`02-architecture.md` lists the entry.

A design audit of the result (the published "Home facelift plan") was then applied on the
maintainer's approval, all three phases: the greeting became a ledger of the sections' counts as
links (HOME-B05), the danger ink pulled back to the summaries with row lateness in muted figures
(HOME-B07), one 28 px leading slot across the grid, recent notes as a row of cards across the spare
columns, row facts at 13 px, the holder's count at the row's end edge (HOME-B10), a quieter "View
all" with the week's link alone carrying a chevron, a KPI without a reading saying so, the headline
reworded around the work, per-section empty copy (HOME-B02) and silent cells on an empty week
(HOME-B14). All of it is class and copy; no payload or provider changed for it.

No new ADR: the change is behaviour and layout, written into `home.md` (HOME-B01, B02, B05, B07,
B10, the new B14 and A08).

## Requirement → scenario

| ID | Test file | Scenario name |
|---|---|---|
| HOME-B14 | `src/modules/home/tests/service.test.ts` | HOME-B14 the due-today section carries the week ahead: seven days from today with their due counts |
| HOME-B14 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B14 draws the week as what is late and then the next seven days with their due counts |
| HOME-B14 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B14 leaves the overdue cell out when the overdue section is not installed |
| HOME-B07 HOME-B14 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B07 HOME-B14 the week leads on the raised surface whatever else the day holds |
| HOME-B07 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B07 orders the grid as the principal asks: actions, waiting, KPIs, then the rest |
| HOME-B01 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B01 draws overdue and due today as one Actions block with two bands |
| HOME-B01 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B01 does not draw a band that has nothing in it |
| HOME-B01 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B01 draws a KPI row as its arc, its share of the target and its state word |
| HOME-B01 | `src/modules/kpis/tests/service.test.ts` | KPIS-B07 … homeSummary (asserts `status` and `ratio` on the rows) |
| HOME-B10 | `src/modules/home/tests/service.test.ts` | HOME-B10 a waiting row is dated by the earliest thing its holder has due (and carries its late share) |
| HOME-B10 | `src/modules/home/tests/service.test.ts` | HOME-B10 waiting work that nobody holds is counted and reported as one last unassigned row |
| HOME-B10 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B10 names the unassigned row in the chase list and gives it no face |
| HOME-B14 HOME-B03 | `src/modules/home/tests/service.test.ts` | HOME-B14 … (each day carries `/tasks?view=all&due=<date>`) |
| HOME-B14 HOME-B03 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B14 draws the week … (the day cell is a link to that href) |
| TASKS-B05 | `src/modules/tasks/tests/service.test.ts` | TASKS-B05 the due facet narrows the list to one calendar day |
| EP-B42 | `src/ui/entity/tests/date-facet.test.tsx` | EP-B42 a date facet is a date picker under its label, beside the choice facets |
| EP-B42 | `src/ui/entity/tests/date-facet.test.tsx` | EP-B42 a chosen day is read back from the facet key and shown on the picker |
| HOME-B05 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B05 the line under the headline is a ledger of the sections, each count a way in |
| HOME-B07 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B07 only the summaries wear the danger ink; a row states its lateness in muted figures |
| HOME-B02 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B02 an empty section answers its own question where it has one |
| HOME-B01 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B01 recent notes are drawn as cards and take the spare columns |
| HOME-B01 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B01 a KPI without a reading says so instead of showing an empty proportion |
| HOME-B14 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B14 the cells fall silent when the heading has already said nothing is due |
| HOME-B02 HOME-A03 | `e2e/preview.spec.ts` | HOME-B02 HOME-A03 uninstalled sections are omitted and AI review section is absent (now asserts the Actions heading and the zero overdue count) |
| HOME-B10 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B10 makes waiting a chase list: one row per person with how much they hold and when the earliest is due |
| HOME-B02 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B02 omits sections whose module is not installed and keeps an installed section at zero (both counts stated in the Actions header) |
| HOME-B12 | `src/modules/home/tests/ui/home-page.test.tsx` | HOME-B12 hands every block that arrives the entrance, in reading order (the week is the lead, one grid) |

Scenarios that asserted the old lead selection ("leads with the first section that actually has
something in it") and the two-column split are replaced by the B07 and B14 scenarios above.

## Files changed

- `src/modules/home/ui/HomeWeek.tsx` — new: the week block, its overdue cell and day cells.
- `src/modules/home/ui/HomeActions.tsx` — new: the Actions block with its two bands.
- `src/modules/home/ui/HomeRow.tsx` — new: the row and its facts, moved out of `HomeStream`; the
  KPI arc and state, the holder's earliest due date, the ageing line.
- `src/modules/home/ui/HomeStream.tsx` — a plain section; no lead variant any more.
- `src/modules/home/ui/HomePage.tsx` — the week leads; one three-column grid.
- `src/modules/home/ui/HomeGreeting.tsx` — the ledger line; the directory link at the far edge.
- `src/modules/home/ui/home-sections.ts` — `days`, `status`, `ratio`; the grid order.
- `src/modules/home/schema/validation.ts`, `src/core/modules/server-manifest.ts` — the same
  three fields on the contract.
- `src/modules/tasks/home.ts` — new: the Home provider, moved out of `service.ts`; the unassigned
  row. `src/modules/tasks/index.ts` and `tests/service.test.ts` follow it.
- `src/modules/tasks/repo.ts` — the week's seven days inside the one home query; the earliest due
  date and late count per holder; the unowned count, date and late count; the waiting predicate
  no longer requires an owner.
- `docs/02-architecture.md` — `home.ts` in the module manifest table.
- `src/ui/entity/types.ts`, `src/ui/entity/EntityFacets.tsx` — a facet may be `kind: 'date'`,
  drawn with `DatePicker` (EP-B42).
- `src/modules/tasks/schema/validation.ts`, `repo.ts`, `ui/TasksPage.tsx`, `src/core/routes.ts` —
  the `due` facet (TASKS-B05); the page declares it as a date facet.
- `docs/features/entity-pages.md` (EP-B42), `docs/features/tasks.md` (TASKS-B05).
- `src/modules/people/manifest.ts` — People moves to the end of the rail, after KPIs (nav order
  60), on the maintainer's request; the phone bar's four slots are now Home, Tasks, Notes and
  Committees, with People behind More (ADMIN-B19 unchanged).
- `openapi.json` — regenerated for the Home response's `days`, `status`, `ratio` and string ids.
- `src/modules/kpis/service.ts` — the row's state and proportion; the attention query built from
  the schema's defaults (the file was at the 400-line limit).
- `src/modules/kpis/ui/index.ts` — exports `useKpiLabels` for Home.
- `src/core/i18n/request.ts`, `src/ui/format.ts` — `weekday` and `dayOfMonth` formats and hooks.
- `src/core/i18n/messages/{en,ar}.json` — `home.actions`, `bandCount`, `week`, `weekOverdue`,
  `due`, `weekDue`, `earliestDue`, `ofTarget`, `unassigned`, `openWeek`, `ledger_*`, `empty*`;
  `tasks.dueOn`; the KPI status words ("On track", "Partially achieved", "Late" and their Arabic);
  the headline reworded around the work; the Arabic plural forms counting tasks rather than items.
- `docs/features/home.md` — B01, B07, B10 rewritten; B14 and A08 added; required scenarios.
- `docs/screenshots/home-{en,ar}-desktop.png` — refreshed.

## Migrations

None.

## Audits

`pnpm audit:all` in the tooling container, 2026-09-16, on the finished tree (seventh run; the
earlier ones caught an e2e scenario that looked for the old "Overdue actions" heading, the
OpenAPI document after the response changed, a spec whose bullets an edit had dropped, and a stale
`kpis.status_thresholds` row a failed run had left in the e2e database):

```
lint, typecheck, depcruise: clean
audit:structure   0 violations
audit:i18n        0 violations, 44 warnings (dynamic keys, as before)
audit:portability 0 violations
audit:docs        0 violations, 13 warnings (accepted specs' uncovered ids, as before)
audit:tests       0 violations, 9 warnings (as before)
audit:deps, audit:secrets, audit:dupes, audit:schema: 0 violations
unit + integration: green
audit:bundle      0 violations, 1 warning (root bundle size reported, as before)
e2e               134 passed (4.8 m)
audit:openapi     0 violations
audit:a11y        0 violations
audit:perf        0 violations, 5 warnings (as before)
```

The shell capture (`tools/capture-preview.mjs --local`, 44 shots) reports colour-contrast on
Home in both locales: the date line, the headline and the ledger links — the greeting block, which
its axe pass reads while the entrance cascade still has it below full opacity (the capture
disables animations for the screenshot, not for the audit) — and the rail's current item, which
the previous hand-off already reported. The gate's `audit:a11y`, which waits for the page to
settle, is clean. Noted under "Out of scope" as a capture-script fix.

## Manual verification

ar desktop ✔ and en desktop ✔ against the preview database on the container dev server, through
every round of the maintainer's review (the strip's three drafts, the unassigned row, the ledger,
the three columns, the day links into the filtered task list). ar 390 px ✔ once, at the timeline
strip stage (the strip folds to four columns in two rows; the bottom bar keeps four destinations
with People behind More). en 390 px: through the gate's browser stage and the refreshed capture
only, not by hand.

## Preview data

The preview workspace's scorecard was seeded through `scripts/db/scorecard.ts` (the same function
`pnpm db:seed` calls, run on its own) so the Attention KPIs rows could be reviewed with real tiles.

## Assumptions

1. The week strip is today plus the next six days, not a calendar week (HOME-B14). The workspace
   records no first weekday, and a rolling window needs no such setting; recorded in the spec.
2. The Actions block's "View all" is the due-today section's href, which is the Tasks today view
   and already shows both bands (TASKS-B04); recorded in HOME-B01.
3. The strip's overdue column carries only its label and count; the ageing line is drawn only in
   the Actions overdue band, no longer under any section that carries `stale` (the KPI section's
   `stale` is a count of stale measures and read as "over a month late" before).
4. The three-column grid orders the sections itself (`home-sections.ts`) rather than following
   the payload's order, which is the ownership order; recorded in HOME-B07.

## Open questions

1. Whether Pending AI reviews, once it has a provider, belongs in the grid after KPIs or before
   Waiting on. The grid order is one list to edit.
2. (Resolved in this branch on the maintainer's instruction.) Each day in the strip opens the
   task list filtered to that date, through a `due` facet on Tasks and a date facet kind in the
   entity framework; see the summary.

## Out of scope, noticed

- `tools/capture-preview.mjs` runs axe before the Home entrance cascade has finished, so anything
  inside `home-rise` is reported as low-contrast while it is fading in. The script should wait for
  the animations to end (or set `prefers-reduced-motion`) before the audit, as the gate does.

- The dev server's page transition logs `InvalidStateError: Transition was aborted because of
  invalid state` on the first load under HMR (`src/ui/layout/PageTransition.tsx`, ADR 0019). Not
  from this change; not seen in the production build.
- `docs/features/home.md` still says "Implementation verified: not yet"; the e2e file covers only
  HOME-B13, and HOME-A01–A03 and the new A08 have no e2e scenario.
