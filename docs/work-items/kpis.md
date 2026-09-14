# KPIs — the strategic scorecard

Implement `docs/features/kpis.md` (KPIS-I01–I04, B01–B12, A01–A08): objectives, KPIs, readings,
quarterly targets, the computed status, the list scorecard, the KPI record, and the Home
"Attention KPIs" section that HOME-B01 reserved and no module answered.

The predecessor's `strategy_*` tables were read from a Mission Control `pg_dump` to confirm the
shape the spec was drawn from (objectives → KPIs → readings → quarterly targets, `direction`,
`category`, `teams`). Nothing was copied: integer ids became UUIDs, statuses are computed at read
time rather than stored, and every write goes through this project's revision, audit and
idempotency rules.

## Decisions taken to the maintainer

1. **Chart library.** `docs/05` names recharts; it was not installed, and `AGENTS.md` makes a new
   dependency an escalation. The maintainer chose recharts over hand-rolled SVG wrappers.
   Consequence: the record's trend and gauge use it behind the dynamically imported panel, and the
   list's sparkline is drawn directly in SVG — fifty charting runtimes in one list put the route's
   own bundle at 321 KB against a 250 KB budget, and a 64×24 mark has no axis, tooltip or legend to
   justify the cost. `docs/05 § Charts` records the split.
2. **Thresholds setting.** `kpis.status_thresholds` held a placeholder (`{ onTrack, atRisk }`) that
   contradicted KPIS-I04. The maintainer approved replacing it with the spec's shape and its
   ordering validation. Nothing read the placeholder, so no migration was needed.
3. **Scope.** Full module plus the Home section. The detail's **Linked section** and **comments**
   are deferred: `core/links` and the `comments` table belong to work that has not shipped. Recorded
   under `## Known gaps` in the spec rather than stubbed.

## Assumptions

Numbered, each with the spec line it fills; a reviewer confirms or reverses them.

1. **KPIS-B07 — where the ranking happens.** A status is a function of today's date and the
   workspace thresholds, not of a column, so filtering, counting and ordering it in SQL would write
   the rules a second time and break the spec's own audit item ("`computeKpiStatus` has one
   definition used by list, detail, Home and tests"). The list therefore reads its candidates in one
   statement and ranks them in the service, paging on the computed tuple with the cursor format of
   `docs/04` (`{ v, sort, filtersHash, last }`). The candidate read is capped at `CANDIDATE_LIMIT`
   (500) and `meta.counts` counts that set; a scorecard is a bounded instrument. Recorded in the
   spec under KPIS-B07.
2. **KPIS-B06 — where objectives are managed.** The spec says objectives have CRUD with manual sort
   but not where. They are workspace vocabulary, like note types and tags, and the entity page
   framework has no slot for a second surface; so they live at `/admin/objectives`, reads are
   session guarded (the KPI picker and the objective facet need them) and writes are admin guarded.
   Recorded in the spec under § UI.
3. **KPIS-B07 — no grouping.** The default order ranks by severity, so rows sharing an objective are
   not contiguous and a group heading would repeat down the page. The objective is named on every
   row and offered as a facet instead. Recorded in the spec under § UI.
4. **`GET /kpis/facets`.** The spec's facets need values the current page may not carry. A small
   read endpoint supplies them, in the shape `/notes/tags` and `/committees/choices` already use.
   Added to the spec's API table.
5. **Home's query budget.** `audit:perf` held every golden path to six queries. Home is not one
   module's path but an aggregate over all of them, and `features/home.md` HOME-A02 already sets its
   budget at twelve; `scripts/audit/perf.ts` now reads that per-path budget, with a scenario for it.
   The per-module ceiling still binds each provider (the registry scenario holds each to two).

## Design notes

The `dataviz` guidance was applied within the house design system, not over it: one ratio against
one limit is a meter bent into an arc rather than a dial, with the figure as the hero and the status
named in words beside it; two series always carry a legend, written in HTML so it survives
translation and the text tokens; the target is a dashed step because it is a threshold; no second
value axis; every chart ships its figures as a visually hidden table, except the row sparkline,
which carries a spoken summary because fifty hidden tables would drown the rows they belong to.
`docs/05 § Charts` now states these as rules.

## Migration

`drizzle/0009_kpis.sql`: `objectives`, `kpis`, `kpi_readings`, `kpi_targets`. Applied to the
disposable test database by the schema audit and to the local preview database. `kpi_readings`
carries `revision` and `updated_by` because KPIS-B08 edits a reading's note in place; `docs/03` was
amended to say so.
