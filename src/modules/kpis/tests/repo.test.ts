import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { countQueries } from '@/core/db/query-log';
import { addDays } from '@/core/time/days';
import { KpiListQuery } from '../schema/validation';
import * as repo from '../repo';
import * as service from '../service';
import { harness, workspaceToday } from './fixtures';
beforeAll(() => migrateDatabase());
beforeEach(() => harness.reset());
afterAll(() => pool().end());
// Every KPI carries its own cadence, so the window is only the day and the earliest year a target
// can still matter for any of them.
const window = (today: string) => ({ today, fromYear: Number(today.slice(0, 4)) - 1 });
const empty = { view: 'all', q: '', objectiveId: '', category: '', ownerId: '' };
it('KPIS-B07 the whole ranked list, its counts and its facets cost three statements', async () => {
  const today = await workspaceToday();
  for (const name of ['One', 'Two', 'Three'])
    await harness.reading((await harness.kpi(name)).id, today, 1);
  const listed = await countQueries(() =>
    harness.run((ctx) => service.listKpis(ctx, KpiListQuery.parse({ view: 'all' }))),
  );
  // The workspace timezone, the thresholds, and one select carrying every candidate row.
  expect(listed.queries).toBe(3);
  expect(listed.result.data).toHaveLength(3);
  const scope = window(today);
  const candidates = await countQueries(() => repo.selectKpis(db(), empty, scope));
  expect(candidates.queries).toBe(1);
  // Categories and objectives; the owners come from the directory, which the service asks for.
  const facets = await countQueries(() => repo.selectFacets(db()));
  expect(facets.queries).toBe(2);
});
it('KPIS-B07 the candidate select carries deleted rows so every view counts from one result', async () => {
  const today = await workspaceToday();
  const kept = await harness.kpi('Kept');
  await harness.reading(kept.id, today, 1);
  const dropped = await harness.kpi('Dropped');
  await harness.run((ctx) => service.removeKpi(ctx, dropped.id, dropped.revision));
  const rows = await repo.selectKpis(db(), empty, window(today));
  expect(rows).toHaveLength(2);
  expect(rows.filter((row) => row.deletedAt)).toHaveLength(1);
});
it('KPIS-B05 the candidate select reads the current, previous and sparkline values as numbers', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Numbers');
  await harness.reading(kpi.id, addDays(today, -2), 12.5);
  await harness.reading(kpi.id, today, 15.25);
  await harness.reading(kpi.id, addDays(today, 10), 99);
  const [row] = await repo.selectKpis(db(), empty, window(today));
  expect(row?.current).toEqual({ date: today, value: 15.25 });
  expect(row?.previous).toBe(12.5);
  expect(row?.sparkline).toEqual([
    { date: addDays(today, -2), value: 12.5 },
    { date: today, value: 15.25 },
  ]);
});
it('KPIS-B02 only the years a status or a comparison can reach are fetched with the row', async () => {
  const today = await workspaceToday();
  const year = Number(today.slice(0, 4));
  const kpi = await harness.kpi('Windowed');
  await harness.targets(kpi.id, [
    { year: year - 3, period: 1, targetValue: 1 },
    { year: year - 1, period: 4, targetValue: 2 },
    { year, period: 1, targetValue: 3 },
  ]);
  const [row] = await repo.selectKpis(db(), empty, window(today));
  expect(row?.targets.map((target) => target.value)).toEqual([2, 3]);
});
it('KPIS-B07 a search term matches the KPI text and excludes the rest', async () => {
  const today = await workspaceToday();
  const found = await harness.kpi('Net promoter', { category: 'Service' });
  await harness.reading(found.id, today, 1);
  await harness.kpi('Headcount', { category: 'People' });
  const rows = await repo.selectKpis(db(), { ...empty, q: 'promoter' }, window(today));
  expect(rows.map((row) => row.id)).toEqual([found.id]);
  expect(await repo.selectKpis(db(), { ...empty, q: 'Service' }, window(today))).toHaveLength(1);
});
