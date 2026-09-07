# Feature: KPIs

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner module:** `src/modules/kpis`

## Purpose

A strategic scorecard: objectives, KPIs, readings, quarterly targets, and a computed status that separates "off target" from "no data" and "no target".

## Vocabulary

| Term | Meaning |
|---|---|
| Direction | `higher` or `lower` is better |
| Reading | dated value; the **current reading** is the latest non-deleted reading with `reading_date ≤ today` |
| Freshness | a KPI's `freshness_days` (default 120); a current reading older than that is **stale** |
| Target | value for `(year, quarter)`; zero and negative allowed |
| Effective target | the current quarter's target, else the earliest future quarter's, else none |
| Status | `on_target` `near_target` `off_target` `no_data` `stale` `no_target` |
| Achievement | percent shown on the gauge (defined below) |

## Data model

See `03-data-model.md`. Invariants:

- KPIS-I01 One reading per KPI per date among non-deleted (unique index; 409 `unique` with `existing` for overwrite).
- KPIS-I02 One target per `(kpi, year, quarter)` (unique); `quarter ∈ 1..4`.
- KPIS-I03 Deleting a KPI soft-deletes it; readings and targets are hidden with the same op id; purge cascades.
- KPIS-I04 Thresholds setting `kpis.status_thresholds = { higher: { on, near }, lower: { on, near } }` validated: `higher.on ≥ higher.near`, `lower.on ≤ lower.near`.

## Behaviors

- KPIS-B01 **Status** by one function `computeKpiStatus({ current, currentDate, target, direction, freshnessDays, thresholds, today })`:
  1. no current reading → `no_data`
  2. current reading older than freshness → `stale`
  3. no effective target → `no_target`
  4. target = 0 or signs differ between current and target (or current is 0 with a nonzero target): `higher`: current ≥ target → on, else off; `lower`: current ≤ target → on, else off (no "near" band without a meaningful ratio)
  5. otherwise ratio = current / target (both same sign): `higher`: ratio ≥ on → on, ≥ near → near, else off; `lower`: ratio ≤ on → on, ≤ near → near, else off. Defaults: higher on 0.99 near 0.85; lower on 1.01 near 1.18.
- KPIS-B02 **Effective target**: quarters in `ctx.timezone`; current quarter first, else earliest future, else none; the label shows which quarter is used.
- KPIS-B03 **Achievement** shown on the gauge: `higher`: `current / target`; `lower`: `target / current` (so 100 percent means on target in both directions); capped at 999 percent for display, arc capped at 100; undefined when target ≤ 0 or current ≤ 0 (gauge shows the status badge only).
- KPIS-B04 **Previous value** = the reading before current; percent change = `(current − previous) / |previous|` when previous ≠ 0 else null. **Previous quarter comparison** = last reading dated in the previous quarter and that quarter's target.
- KPIS-B05 **Sparkline**: last 8 readings up to today.
- KPIS-B06 **Objectives** CRUD with manual sort; deleting an objective soft-deletes it and leaves `objective_id` on KPIs and initiatives (chip renders "archived"); purge nulls.
- KPIS-B07 **List** rows: status dot and label, name, current value with unit, effective target with quarter label, change arrow, category, sparkline. Views `all` (default), `attention` (off, stale, no_data), `on_target`, `near_target`, `off_target`, `no_data`, `stale`, `no_target`, `trash`. Facets objective, category, team, `linkedTo`. Sort: severity (off, stale, no_data, near, no_target, on) then name (default); name; change.
- KPIS-B08 **Detail**: header, gauge card, trend chart (readings up to today with target line per quarter), readings table (add, edit note, delete), targets table with "set year" (four inputs), notes, Linked section, comments.
- KPIS-B09 **Readings**: date defaults to today; future dates allowed (excluded from current until reached) and flagged; duplicate date → 409 offering overwrite (`PUT /kpis/:id/readings/:date`).
- KPIS-B10 **Threshold changes** in Settings invalidate all KPI lists and details (statuses are computed at read time).
- KPIS-B11 **Quarter rollover**: statuses are computed per request; the list refetches on the day change like tasks.
- KPIS-B12 **Invalidation**: reading and target mutations invalidate the KPI detail, KPI lists and counts, Home; objective changes invalidate objectives and KPI lists.

## API

| Verb | Path |
|---|---|
| GET/POST | `/objectives`; PATCH/DELETE/restore `/objectives/:id`; PATCH `/objectives/reorder` |
| GET | `/kpis` (`view, q, objectiveId, category, team, linkedTo, sort, limit, cursor`); items carry `meta { current, currentDate, previous, percentChange, effectiveTarget, effectiveTargetLabel, status, achievement, sparkline }` |
| POST | `/kpis`; GET/PATCH/DELETE/restore `/kpis/:id` (detail adds `readings[]` last 200, `targets[]`, `previousQuarter`) |
| GET/POST | `/kpis/:id/readings`; PUT `/kpis/:id/readings/:date`; PATCH/DELETE `/kpis/:id/readings/:readingId` |
| GET/PUT | `/kpis/:id/targets` (PUT upserts `[{ year, quarter, targetValue }]`); DELETE `/kpis/:id/targets/:targetId` |
| GET/POST | `/comments?entityType=kpi&entityId=` |

## UI

Charts via wrappers (Sparkline, TrendChart, Gauge). RTL: time axis right-to-left, readings table order unchanged (chronological), labels logical. Year form tab order Q1→Q4. Mobile: gauge, trend, readings.

## Acceptance criteria

- KPIS-A01 `higher`, target 100, current 99 → on; 85 → near; 84 → off. `lower`, target 100, current 101 → on; 118 → near; 119 → off. (en)
- KPIS-A02 No reading → `no_data`; a reading older than freshness → `stale`; no current or future target → `no_target`. (en)
- KPIS-A03 Target 0 with direction `lower` and current 0 → on; current 3 → off; gauge shows badge only. (en)
- KPIS-A04 Adding a reading updates row, gauge, trend, and counts without reload; a future-dated reading is flagged and does not change status. (en, ar)
- KPIS-A05 Setting a year's targets creates four; changing the current quarter's target changes status immediately. (en, ar)
- KPIS-A06 Changing thresholds in Settings changes statuses across the list. (en)
- KPIS-A07 Deleting an objective keeps KPIs listed under an "archived objective" label. (en)
- KPIS-A08 RTL chart renders with a right-to-left time axis and passes the overflow measurement. (ar)

## Required scenarios

- schema: directions, quarters, thresholds validation, reading value range.
- service: B01 full matrix (both directions × each branch × boundaries ± 0.0001), B02 across quarter and year boundaries in two timezones, B03 undefined cases, B04 zero previous, freshness at exactly `freshness_days`, future readings, target deletion effect.
- constraints: reading and target uniqueness via raw SQL.
- repo: list meta in ≤ 3 queries, severity sort, views equal counts.
- api: all endpoints; PUT overwrite; 409 duplicate.
- ui: gauge > 100 and undefined, year form, readings add, RTL axis snapshot.
- e2e `kpis.spec.ts`: A01–A08.
- Mutation targets: `computeKpiStatus`, `resolveEffectiveTarget`, `achievement`.

## Audit items

- `computeKpiStatus` has one definition used by list, detail, Home, and tests.
- Chart wrappers are the only importers of the chart library.

## Out of scope

Formulas, imports from spreadsheets, forecasting.
