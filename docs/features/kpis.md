# Feature: KPIs

**Status:** implemented
**Spec reviewed:** 2026-09-07
**Implementation verified:** 2026-09-14
**Owner module:** `src/modules/kpis`

## Purpose

A strategic scorecard: objectives, KPIs, readings, a target per reporting period, and a computed status that separates "off target" from "no data" and "no target".

## Vocabulary

| Term | Meaning |
|---|---|
| Direction | `higher` or `lower` is better; one press-to-flip control, green one way and red the other |
| Frequency | `monthly`, `quarterly` or `annual`: the cadence the KPI is reported on. It decides what a period is everywhere — the target a reading is measured against, the axis of the trend, the steps of the record's toggle, and how long a reading stays current |
| Unit | one of `count`, `percent`, `sar`, `usd`, `points`, each with its own symbol; free text is not a unit |
| Owner | the assignable person who holds the measure (ADR 0011); there are no team names |
| Reading | dated value; the **current reading** is the latest non-deleted reading with `reading_date ≤ today` |
| Period | one reporting period of the KPI's frequency: 1..12 monthly, 1..4 quarterly, 1 annually |
| Target | value for `(year, period)`; zero and negative allowed |
| Effective target | the current period's target, else the earliest future period's, else none |
| Status | `on_target` `near_target` `off_target` `no_data` `stale` `no_target` |
| Achievement | percent shown on the gauge (defined below) |

## Data model

See `03-data-model.md`. Invariants:

- KPIS-I01 One reading per KPI per date among non-deleted (unique index; 409 `unique` with `existing` for overwrite).
- KPIS-I02 One target per `(kpi, year, period)` (unique); `period ∈ 1..12`, read at the KPI's frequency.
- KPIS-I03 Deleting a KPI soft-deletes it; readings and targets are hidden with the same op id; purge cascades.
- KPIS-I04 Thresholds setting `kpis.status_thresholds = { higher: { on, near }, lower: { on, near } }` validated: `higher.on ≥ higher.near`, `lower.on ≤ lower.near`.

## Behaviors

- KPIS-B01 **Status** by one function `computeKpiStatus({ current, currentDate, target, direction, frequency, thresholds, today })`:
  1. no current reading → `no_data`
  2. current reading more than one reporting period behind → `stale`. One missed report is lag; more than one is nobody maintaining the measure, and a monthly KPI falls behind four times faster than a quarterly one.
  3. no effective target → `no_target`
  4. target = 0 or signs differ between current and target (or current is 0 with a nonzero target): `higher`: current ≥ target → on, else off; `lower`: current ≤ target → on, else off (no "near" band without a meaningful ratio)
  5. otherwise ratio = current / target (both same sign): `higher`: ratio ≥ on → on, ≥ near → near, else off; `lower`: ratio ≤ on → on, ≤ near → near, else off. Defaults: higher on 0.99 near 0.85; lower on 1.01 near 1.18.
- KPIS-B02 **Effective target**: periods of the KPI's frequency, in `ctx.timezone`; current period first, else earliest future, else none; the record names which period is used.
- KPIS-B03 **Achievement** shown on the gauge: `higher`: `current / target`; `lower`: `target / current` (so 100 percent means on target in both directions); capped at 999 percent for display, arc capped at 100; undefined when target ≤ 0 or current ≤ 0 (gauge shows the status badge only). The arc spans between the two figures it compares: the current reading under one foot, the target under the other. A period toggle moves the comparison to the period before the effective one or the one after it, and the arc, the percentage, the badge and the target figure all move with it; the toggle carries the dates, so the two figures under the arc do not repeat them. It opens on the effective period, so the record starts on the answer the row it was opened from was showing. The neighbours never read `stale`: the question they answer is whether a period's target was met, which does not go out of date.
- KPIS-B04 **Previous value** = the last reading dated in the previous reporting period, and percent change = `(current − previous) / |previous|` against that, when it is not 0, else null. It is deliberately not the reading immediately before the current one: a measure read more often than it is reported would then state a change against a figure from the middle of the same period, which is not a movement anybody is accountable for. The two coincide whenever a measure is read once per period, which is most of them. **Previous period comparison** = last reading dated in the previous period and that period's target; the trend's own previous-period column and the toggle's left step carry it on screen, so the record does not also print it as a row. The newest reading whose note says anything is quoted under the headline: it is the one field on the page that says *why* a number moved.
- KPIS-B05 **Recent readings**: `meta.sparkline` carries the last 8 readings up to today. Nothing
  draws them as a mark any more. A tile answers where a measure stands against its target, and the
  shape of the readings was a second mark competing with the one that carries that (KPIS-B07); the
  record shows the same history properly, as the trend. The figures stay in the payload because
  they are what any future reading of recent movement would be drawn from, and they cost one
  aggregate in a select the row already makes.
- KPIS-B06 **Objectives** CRUD with manual sort; deleting an objective soft-deletes it and leaves `objective_id` on KPIs and initiatives (chip renders "archived"); purge nulls.
- KPIS-B07 **List** tiles (EP-B27): name, the objective it serves, the status as one chip whose
  wash is the mark and whose label is the word, an arc carrying how far through the target the
  measure is with that figure inside it, the current reading with its unit, the change since the
  previous reading, and the effective target with its period. The arc is the instrument the page is
  scanned by: a column of them is read without reading anything, because the short ones are the
  ones to open. It is the record's gauge drawn directly in SVG rather than through the chart
  library, for the reason the sparkline was (`docs/05`): a list holds fifty of these and a charting
  runtime per tile costs more than the rest of the page. A measure with no target keeps an empty
  track and a dash, never a zero, which is a different and worse answer.
  The whole tile is never painted its status colour. It is the obvious executive look and it
  defeats itself: when every tile shouts the eye has nothing to catch on, and light text on a
  saturated ground gives up the contrast the status scale was measured to hold (`src/ui/tokens.css`).
  The surface stays neutral so the marks can carry the state.
  Neither the owner nor the category appears on a tile. An owner is read once a measure has been
  opened, and a column of proper nouns sits between the eye and the figures; a category is a facet,
  which is where it is used.
  Views `all` (default), `attention` (off, stale, no_data), `on_target`, `near_target`,
  `off_target`, `no_data`, `stale`, `no_target`, `trash`. Facets objective, category, owner,
  `linkedTo`. The list is grouped by the objective each measure serves, because a measure means
  little apart from the thing it is meant to move. Sort: the default files the scorecard under its
  objectives, severity (off, stale, no_data, near, no_target, on) then name inside each; objectives
  themselves are alphabetical rather than ranked by their worst measure, because a scorecard is read
  on the cadence it reports on and an order that reshuffles as statuses change costs the reader what
  repetition buys them — what is off track is found from the views and the strip above, which exist
  for it. Measures filed under no objective are a group too, and go last. Also name; change; each
  of which suppresses the grouping (EP-B14).
- KPIS-B26 **Comparison period**: one reading applies to the whole page, chosen from a segmented
  control in the toolbar (EP-B28) and carried in the URL as `period=previous|next`, empty being the
  effective one. It is not a filter: it removes no measure from the list, it changes what every one
  of them says. Everything downstream of a status follows it — each tile's arc, target and period,
  the statuses themselves, the counts in the strip and the rail, and the default order — because a
  scorecard read half against one quarter and half against another is not a scorecard. A shifted
  reading names its period exactly rather than rolling forward to the next plan, since the question
  it answers is "was that target met" and that is about one period and no other; a measure with no
  target in that period reads as having none. Freshness is dropped with the shift, for the reason
  the record's neighbouring periods drop it (KPIS-B08): a target already past does not go stale.
  A status is a function of today's date and the workspace thresholds rather than of a column, so it
  cannot be filtered, counted or ordered in SQL without writing the rules a second time. The list
  therefore reads its candidates in one statement, ranks them with `computeKpiStatus`, and pages on
  that ranking with the cursor format of `04-api-conventions.md` (`{ v, sort, filtersHash, last }`,
  where `last` is the computed sort tuple). A scorecard is a bounded instrument; the candidate read
  is capped at `CANDIDATE_LIMIT` rows and `meta.counts` counts that set.
  The values the facets offer come from `GET /kpis/facets` rather than from the page on screen, so a
  filter can name a category no row of the current page happens to carry. The owners it offers are
  the assignable directory, not the people who already hold a KPI, so a measure can be handed to
  somebody who holds none yet.
- KPIS-B08 **Detail**: the record reads as a record and becomes a form on contact, the way every other entity's panel does (EP-B25). It is ordered by what a principal asks, in the order they ask it: the name, the answer **in a sentence** ("48% against a 90% target for Q3 2026 — off target, last read three weeks ago"), the gauge that confirms it, the owner's own words on the newest reading that carries any, then who holds the measure and what it belongs to. The history follows, then the readings and the targets, and the shared entity footer (EP-B37) carrying when it was last written and the destructive action. Everything the measure is **maintained** from leaves the reading. The reading history and the year's targets become two tasks the record offers, each opening into a dialog: they are work, done by the owner a few times a quarter, and each is a table wider than the record column it would otherwise sit in — twelve monthly target inputs wrap into three cramped rows there. Each control says on its face how much sits behind it, so nothing has to be opened to find out whether it is empty. Inside the readings dialog, recording one is folded away behind a single control and a reading's note reads as text until it is touched; the targets form is also their display, so no table repeats the numbers the form already holds, and the year it covers is stepped from one control rather than chosen from a row of chips beside a labelled box. The **definition** — name, direction, unit, cadence and filing — stays in the record but folds away at the end: the owner sets it once and nobody reads it again, so it does not stand between the answer and the evidence. The gauge is a meter bent into an arc rather than a dial: one ratio against one limit, the arc capped at the limit, and the status named in words below it so the state never travels as colour alone. The figure inside the arc says what it is ("of target"): on a KPI whose unit is itself a percentage, a bare percentage in the middle reads as the measure and means the opposite. The trend is the reporting periods up to this one as columns, whether or not each was reported: a period nobody recorded is the thing a scorecard most needs to show, and joining across the gap would draw a tidy line through it. It runs to the end of the year being planned when targets reach that far, so a plan set for four quarters reads as four columns with the unreported ones still standing under their targets: the distance between what was planned and what has been reported is the chart's whole job. It reaches back to the oldest reading or target and never further — blank columns from before a measure existed report a gap in a record that had not started — holds at most eight columns, the newest ones, and widens them when there are fewer than four. Several readings inside one period are that period's latest figure, and the period's target is a dot on its own column, joined into a line. The measurement is the mass, the target is the rule it is read against, and two marks of different kinds are never mistaken for two measures. Both marks carry their value as a figure, so the plot needs no value axis and no gridlines behind it; the axis is labelled at the KPI's cadence. The columns carry the KPI's status colour so the figure, the arc and the history all say the same thing; the legend names both marks and is always present. Linked section and comments: see Known gaps.
- KPIS-B09 **Readings**: date defaults to today; future dates allowed (excluded from current until reached) and flagged; duplicate date → 409 offering overwrite (`PUT /kpis/:id/readings/:date`).
- KPIS-B10 **Threshold changes** in Settings invalidate all KPI lists and details (statuses are computed at read time).
- KPIS-B11 **Quarter rollover**: statuses are computed per request; the list refetches on the day change like tasks.
- KPIS-B12 **Invalidation**: reading and target mutations invalidate the KPI detail, KPI lists and counts, Home; objective changes invalidate objectives and KPI lists.

## API

| Verb | Path |
|---|---|
| GET/POST | `/objectives`; PATCH/DELETE/restore `/objectives/:id`; PATCH `/objectives/reorder` |
| GET | `/kpis` (`view, q, objectiveId, category, ownerId, linkedTo, sort, limit, cursor`); items carry `meta { current, currentDate, previous, percentChange, effectiveTarget, effectiveTargetPeriod, status, achievement, sparkline }` |
| GET | `/kpis/facets` → `{ categories, owners, objectives }`, the values the rail's facets offer |
| POST | `/kpis`; GET/PATCH/DELETE/restore `/kpis/:id` (detail adds `readings[]` last 200, `targets[]`, `previousPeriod`, and `periods[]`: the effective period with the one either side, each as `{ year, period, target, achievement, status }`) |
| GET/POST | `/kpis/:id/readings`; PUT `/kpis/:id/readings/:date`; PATCH/DELETE `/kpis/:id/readings/:readingId` |
| GET/PUT | `/kpis/:id/targets` (PUT upserts `[{ year, period, targetValue }]`); DELETE `/kpis/:id/targets/:targetId` |
| GET/POST | `/comments?entityType=kpi&entityId=` |

## UI

Charts via wrappers (TrendChart, Gauge). RTL: time axis right-to-left, readings table order unchanged (chronological), labels logical. The year form offers one input per period of the KPI's cadence — twelve, four or one — in order, so the tab key walks the year the way it is reported. Mobile: gauge, trend, readings.

Objectives are managed from Administration (`/admin/objectives`), beside the other workspace
vocabularies (note types, tags). They are read by every member — the KPI picker and the objective
facet need them — and written by an administrator, which is why `GET /objectives` is session
guarded and every objective write is admin guarded.

Status is carried by one scale of three colours, defined once in `src/ui/tokens.css` and used by the
dot, the chip, the spark, the columns, the arc and the counts in the featured strip: green on
target, amber near it, red off it, and the text grey for the three states that are not a verdict.
The dark values are the predecessor's own; the light values are darker steps of the same hues,
because the originals were chosen against a near-black ground. A word takes the scale's ink variant
rather than the mark value where the two differ, since a mark needs 3:1 and a word needs 4.5:1.

The list is not grouped. Its default order ranks by severity, so rows sharing an objective are not
contiguous and a group heading would repeat down the page; the objective is named on every row and
offered as a facet instead.

The list page's featured strip is the scorecard band: how the measures divide between on target,
near target, off target and no data. "Needs attention" stays a rail view rather than a fifth tile,
because it is the same rows counted a second time.

## Acceptance criteria

- KPIS-A01 `higher`, target 100, current 99 → on; 85 → near; 84 → off. `lower`, target 100, current 101 → on; 118 → near; 119 → off. (en)
- KPIS-A02 No reading → `no_data`; a reading more than one period behind → `stale`; no current or future target → `no_target`. (en)
- KPIS-A03 Target 0 with direction `lower` and current 0 → on; current 3 → off; gauge shows badge only. (en)
- KPIS-A04 Adding a reading updates row, gauge, trend, and counts without reload; a future-dated reading is flagged and does not change status. (en, ar)
- KPIS-A05 Setting a year's targets creates one per period of the cadence; changing the current period's target changes status immediately. (en, ar)
- KPIS-A06 Changing thresholds in Settings changes statuses across the list. (en)
- KPIS-A07 Deleting an objective keeps KPIs listed under an "archived objective" label. (en)
- KPIS-A08 RTL chart renders with a right-to-left period axis and passes the overflow measurement. (ar)

## Required scenarios

- schema: directions, cadences, units, periods, thresholds validation, reading value range.
- service: B01 full matrix (both directions × each branch × boundaries ± 0.0001), B02 across period and year boundaries in two timezones and all three cadences, B03 undefined cases, B04 zero previous, staleness at exactly one period behind, future readings, target deletion effect.
- constraints: reading and target uniqueness via raw SQL; the direction, cadence and unit lists.
- repo: list meta in ≤ 3 queries, severity sort, views equal counts.
- api: all endpoints; PUT overwrite; 409 duplicate.
- ui: gauge > 100 and undefined, year form, readings add, RTL axis snapshot.
- e2e `kpis.spec.ts`: A01–A08.
- Mutation targets: `computeKpiStatus`, `resolveEffectiveTarget`, `achievement`.

## Audit items

- `computeKpiStatus` has one definition used by list, detail, Home, and tests.
- Chart wrappers are the only importers of the chart library.

## Known gaps

The detail panel's **Linked section** and **comments** have no implementation: `core/links` and the
`comments` table are owned by work that has not shipped. Everything else in KPIS-B08 is present, and
the two sections are added by the modules that own them rather than duplicated here.

## Out of scope

Formulas, imports from spreadsheets, forecasting.
