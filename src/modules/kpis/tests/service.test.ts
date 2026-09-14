import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { writeSetting } from '@/core/db/settings-repo';
import { addDays } from '@/core/time/days';
import { periodOf, shiftPeriod } from '@/core/time/kpis';
import { KpiListQuery } from '../schema/validation';
import * as service from '../service';
import { harness, workspaceToday } from './fixtures';
const run = harness.run;
const list = (query: Partial<KpiListQuery> = {}) =>
  run((ctx) => service.listKpis(ctx, KpiListQuery.parse(query)));
beforeAll(() => migrateDatabase());
beforeEach(() => harness.reset());
afterAll(() => pool().end());
const periodOfToday = async () => periodOf(await workspaceToday(), 'quarterly');
it('KPIS-I01 KPIS-B09 a second reading for the same day is a conflict that names the row to overwrite', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Revenue');
  await harness.reading(kpi.id, today, 10);
  await expect(harness.reading(kpi.id, today, 20)).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'unique' },
  });
  const after = await run((ctx) =>
    service.overwriteReading(ctx, kpi.id, today, { value: 20, note: 'restated' }),
  );
  expect(after.readings).toHaveLength(1);
  expect(after.meta.current).toBe(20);
  expect(after.readings[0]?.note).toBe('restated');
});
it('KPIS-B09 a future reading is flagged and does not become the current one', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Uptime');
  await harness.reading(kpi.id, addDays(today, -1), 90);
  const detail = await harness.reading(kpi.id, addDays(today, 30), 99);
  expect(detail.meta.current).toBe(90);
  expect(detail.readings.find((row) => row.value === 99)?.future).toBe(true);
  expect(detail.readings.find((row) => row.value === 90)?.future).toBe(false);
  expect(detail.meta.sparkline.map((point) => point.value)).toEqual([90]);
});
it('KPIS-B05 KPIS-B04 KPIS-B08 the record carries the last eight readings, the previous value and its quarter', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Throughput');
  for (let index = 9; index >= 0; index -= 1)
    await harness.reading(kpi.id, addDays(today, -index * 3), 10 + index);
  const before = shiftPeriod(await periodOfToday(), -1, 'quarterly');
  await harness.targets(kpi.id, [{ ...before, targetValue: 5 }]);
  const detail = await run((ctx) => service.getKpiDetail(ctx, kpi.id));
  expect(detail.meta.sparkline).toHaveLength(8);
  expect(detail.meta.sparkline.at(-1)?.value).toBe(10);
  expect(detail.meta.current).toBe(10);
  expect(detail.meta.previous).toBe(11);
  expect(detail.meta.percentChange).toBeCloseTo(-1 / 11);
  expect(detail.previousPeriod).toMatchObject({ ...before, target: 5 });
  expect(detail.readings).toHaveLength(10);
});
it('KPIS-I02 KPIS-A05 setting a year writes four quarters and replaces the ones already there', async () => {
  const kpi = await harness.kpi('Margin');
  const { year } = await periodOfToday();
  const items = [1, 2, 3, 4].map((period) => ({ year, period, targetValue: period * 10 }));
  const detail = await harness.targets(kpi.id, items);
  expect(detail.targets).toHaveLength(4);
  const current = await periodOfToday();
  expect(detail.meta.effectiveTarget).toBe(current.period * 10);
  const again = await harness.targets(kpi.id, [{ ...current, targetValue: 999 }]);
  expect(again.targets).toHaveLength(4);
  expect(again.meta.effectiveTarget).toBe(999);
  const [first] = again.targets;
  if (!first) throw new Error('expected a target');
  await run((ctx) => service.removeTarget(ctx, kpi.id, first.id));
  expect((await run((ctx) => service.getKpiDetail(ctx, kpi.id))).targets).toHaveLength(3);
});
it('KPIS-B11 KPIS-A05 a target changes the status on the next read without touching the KPI row', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Backlog', { direction: 'lower' });
  await harness.reading(kpi.id, today, 50);
  expect((await run((ctx) => service.getKpi(ctx, kpi.id))).meta.status).toBe('no_target');
  const current = await periodOfToday();
  const withTarget = await harness.targets(kpi.id, [{ ...current, targetValue: 60 }]);
  expect(withTarget.meta.status).toBe('on_target');
  // The status is derived, never stored: the entity itself was not written to.
  expect(withTarget.revision).toBe(kpi.revision);
});
it('KPIS-B10 changing the workspace thresholds changes statuses across the list', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Adoption');
  await harness.reading(kpi.id, today, 90);
  await harness.targets(kpi.id, [{ ...(await periodOfToday()), targetValue: 100 }]);
  expect((await list()).data[0]?.meta.status).toBe('near_target');
  const actor = harness.user;
  if (!actor) throw new Error('expected an actor');
  await writeSetting(
    db(),
    'kpis.status_thresholds',
    { higher: { on: 0.9, near: 0.5 }, lower: { on: 1.01, near: 1.18 } },
    actor.id,
  );
  expect((await list()).data[0]?.meta.status).toBe('on_target');
});
it('KPIS-B07 views, counts and the severity sort rank what needs attention first', async () => {
  const today = await workspaceToday();
  const current = await periodOfToday();
  const on = await harness.kpi('Zulu on target');
  await harness.reading(on.id, today, 100);
  await harness.targets(on.id, [{ ...current, targetValue: 100 }]);
  const off = await harness.kpi('Alpha off target');
  await harness.reading(off.id, today, 10);
  await harness.targets(off.id, [{ ...current, targetValue: 100 }]);
  const stale = await harness.kpi('Bravo stale');
  await harness.reading(stale.id, addDays(today, -400), 10);
  await harness.targets(stale.id, [{ ...current, targetValue: 100 }]);
  const empty = await harness.kpi('Charlie no data');
  const untargeted = await harness.kpi('Delta no target');
  await harness.reading(untargeted.id, today, 3);
  const all = await list({ view: 'all' });
  expect(all.data.map((row) => row.id)).toEqual([off.id, stale.id, empty.id, untargeted.id, on.id]);
  expect(all.meta.counts).toMatchObject({
    all: 5,
    attention: 3,
    on_target: 1,
    off_target: 1,
    stale: 1,
    no_data: 1,
    no_target: 1,
    trash: 0,
  });
  expect((await list({ view: 'attention' })).data.map((row) => row.id)).toEqual([
    off.id,
    stale.id,
    empty.id,
  ]);
  expect((await list({ view: 'no_data' })).data.map((row) => row.id)).toEqual([empty.id]);
  const byName = await list({ view: 'all', sort: 'name' });
  expect(byName.data.map((row) => row.name)).toEqual([
    'Alpha off target',
    'Bravo stale',
    'Charlie no data',
    'Delta no target',
    'Zulu on target',
  ]);
});
it('KPIS-B07 the cursor continues the ranking it was issued for', async () => {
  const today = await workspaceToday();
  for (const name of ['A', 'B', 'C']) await harness.reading((await harness.kpi(name)).id, today, 1);
  const first = await list({ view: 'all', sort: 'name', limit: 2 });
  expect(first.data.map((row) => row.name)).toEqual(['A', 'B']);
  expect(first.meta.nextCursor).toBeTruthy();
  const second = await list({
    view: 'all',
    sort: 'name',
    limit: 2,
    cursor: first.meta.nextCursor ?? '',
  });
  expect(second.data.map((row) => row.name)).toEqual(['C']);
  expect(second.meta.nextCursor).toBeNull();
  await expect(
    list({ view: 'all', sort: 'change', cursor: first.meta.nextCursor ?? '' }),
  ).rejects.toMatchObject({ code: 'validation_failed' });
});
it('KPIS-B07 the change sort ranks by movement and leaves unmoved KPIs last', async () => {
  const today = await workspaceToday();
  const big = await harness.kpi('Doubled');
  await harness.reading(big.id, addDays(today, -2), 10);
  await harness.reading(big.id, today, 20);
  const small = await harness.kpi('Nudged');
  await harness.reading(small.id, addDays(today, -2), 10);
  await harness.reading(small.id, today, 11);
  const still = await harness.kpi('Single reading');
  await harness.reading(still.id, today, 10);
  const ranked = await list({ view: 'all', sort: 'change' });
  expect(ranked.data.map((row) => row.id)).toEqual([big.id, small.id, still.id]);
});
it('KPIS-I03 deleting a KPI hides its readings and targets under one operation and restores them', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Retire me');
  const earlier = await harness.reading(kpi.id, addDays(today, -5), 1);
  await harness.reading(kpi.id, today, 2);
  await harness.targets(kpi.id, [{ ...(await periodOfToday()), targetValue: 9 }]);
  const [oldest] = earlier.readings;
  if (!oldest) throw new Error('expected a reading');
  await run((ctx) => service.removeReading(ctx, kpi.id, oldest.id));
  const current = await run((ctx) => service.getKpi(ctx, kpi.id));
  const { opId } = await run((ctx) => service.removeKpi(ctx, kpi.id, current.revision));
  await expect(run((ctx) => service.getKpi(ctx, kpi.id))).rejects.toMatchObject({
    code: 'not_found',
  });
  expect((await list({ view: 'trash' })).data.map((row) => row.id)).toEqual([kpi.id]);
  const restored = await run((ctx) => service.restoreKpi(ctx, kpi.id, opId));
  // The reading deleted before the KPI carried a different operation id, so it stays deleted.
  expect(restored.readings).toHaveLength(1);
  expect(restored.targets).toHaveLength(1);
  expect(restored.meta.current).toBe(2);
});
it('KPIS-B06 KPIS-A07 a deleted objective keeps its KPIs and marks them archived', async () => {
  const objective = await harness.objective('Grow');
  const kpi = await harness.kpi('Revenue', { objectiveId: objective.id });
  expect((await run((ctx) => service.listObjectives(ctx))).data[0]?.kpiCount).toBe(1);
  await run((ctx) => service.removeObjective(ctx, objective.id, objective.revision));
  const listed = await list({ view: 'all' });
  expect(listed.data[0]).toMatchObject({
    id: kpi.id,
    objectiveId: objective.id,
    objectiveName: 'Grow',
    objectiveDeleted: true,
  });
  await expect(harness.kpi('Another', { objectiveId: objective.id })).rejects.toMatchObject({
    code: 'rule_violation',
    details: { rule: 'KPIS-B06' },
  });
});
it('KPIS-B06 objectives are created, renamed, ordered by hand and restored', async () => {
  const first = await harness.objective('First');
  const second = await harness.objective('Second');
  await run((ctx) =>
    service.reorderObjectives(ctx, [
      { id: second.id, revision: second.revision },
      { id: first.id, revision: first.revision },
    ]),
  );
  expect((await run((ctx) => service.listObjectives(ctx))).data.map((row) => row.name)).toEqual([
    'Second',
    'First',
  ]);
  const renamed = await run((ctx) =>
    service.patchObjective(ctx, first.id, { name: 'Renamed', revision: 2 }),
  );
  expect(renamed.name).toBe('Renamed');
  const { opId } = await run((ctx) => service.removeObjective(ctx, first.id, renamed.revision));
  expect((await run((ctx) => service.listObjectives(ctx))).data).toHaveLength(1);
  await run((ctx) => service.restoreObjective(ctx, first.id, opId));
  expect((await run((ctx) => service.listObjectives(ctx))).data).toHaveLength(2);
});
it('KPIS-B07 facets narrow the list and the counts follow the narrowed set', async () => {
  const today = await workspaceToday();
  const objective = await harness.objective('Grow');
  const inside = await harness.kpi('Inside', {
    objectiveId: objective.id,
    category: 'Finance',
  });
  await harness.reading(inside.id, today, 1);
  await harness.kpi('Outside', { category: 'People' });
  expect((await list({ view: 'all', category: 'Finance' })).data.map((row) => row.id)).toEqual([
    inside.id,
  ]);

  expect((await list({ view: 'all', objectiveId: objective.id })).meta.counts.no_data).toBe(0);
  expect((await list({ view: 'all', objectiveId: 'none' })).data.map((row) => row.name)).toEqual([
    'Outside',
  ]);
  expect((await list({ view: 'all', q: 'Outside' })).meta.counts.all).toBe(1);
  const facets = await run((ctx) => service.kpiFacets(ctx));
  expect(facets.categories).toEqual(['Finance', 'People']);
  expect(facets.owners).toEqual([]);
  expect(facets.objectives.map((row) => row.name)).toEqual(['Grow']);
});
it('KPIS-B12 HOME-B01 the home section carries the KPIs that need attention, worst first', async () => {
  const today = await workspaceToday();
  const current = await periodOfToday();
  const healthy = await harness.kpi('Healthy');
  await harness.reading(healthy.id, today, 100);
  await harness.targets(healthy.id, [{ ...current, targetValue: 100 }]);
  const failing = await harness.kpi('Failing');
  await harness.reading(failing.id, today, 1);
  await harness.targets(failing.id, [{ ...current, targetValue: 100 }]);
  const stale = await harness.kpi('Stale');
  await harness.reading(stale.id, addDays(today, -400), 1);
  const [section] = await run((ctx) => service.homeSummary(ctx, today));
  expect(section).toMatchObject({ key: 'kpis', enabled: true, count: 2, stale: 1 });
  expect(section?.items.map((item) => item.title)).toEqual(['Failing', 'Stale']);
  expect(section?.href).toContain('view=attention');
});
