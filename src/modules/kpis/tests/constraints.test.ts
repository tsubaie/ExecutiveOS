import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { harness, workspaceToday } from './fixtures';
beforeAll(() => migrateDatabase());
beforeEach(() => harness.reset());
afterAll(() => pool().end());
const reading = (kpiId: string, day: string, value = 1) =>
  db().execute(
    sql`insert into kpi_readings (id, kpi_id, reading_date, value) values (gen_random_uuid(), ${kpiId}::uuid, ${day}::date, ${value})`,
  );
const target = (kpiId: string, year: number, period: number, value = 1) =>
  db().execute(
    sql`insert into kpi_targets (id, kpi_id, year, period, target_value) values (gen_random_uuid(), ${kpiId}::uuid, ${year}, ${period}, ${value})`,
  );
it('KPIS-I01 the database keeps one live reading per KPI per date', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Guarded');
  await expect(reading(kpi.id, today)).resolves.toBeTruthy();
  await expect(reading(kpi.id, today, 2)).rejects.toMatchObject({
    cause: { constraint: 'kpi_readings_date_unique' },
  });
  // The index is partial, so a deleted reading leaves the date free again.
  await db().execute(
    sql`update kpi_readings set deleted_at = now(), deleted_op_id = gen_random_uuid() where kpi_id = ${kpi.id}::uuid`,
  );
  await expect(reading(kpi.id, today, 2)).resolves.toBeTruthy();
});
it('KPIS-I02 the database keeps one live target per KPI per period and rejects a thirteenth', async () => {
  const kpi = await harness.kpi('Targeted');
  await expect(target(kpi.id, 2026, 3)).resolves.toBeTruthy();
  await expect(target(kpi.id, 2026, 3, 2)).rejects.toMatchObject({
    cause: { constraint: 'kpi_targets_period_unique' },
  });
  await expect(target(kpi.id, 2026, 13)).rejects.toMatchObject({
    cause: { constraint: 'kpi_targets_period_check' },
  });
  // Twelve is a month of a monthly KPI, so the column has to reach it.
  await expect(target(kpi.id, 2026, 12)).resolves.toBeTruthy();
  await expect(target(kpi.id, 2026, 4, -5)).resolves.toBeTruthy();
});
it('KPIS-I01 KPIS-I02 values outside the documented magnitude are rejected by the database', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Bounded');
  // docs/03 § Numbers: numeric(14,4) is the boundary itself, so the largest representable reading
  // is accepted and anything past it is refused before the CHECK that restates the same limit.
  await expect(reading(kpi.id, today, 9_999_999_999.9999)).resolves.toBeTruthy();
  await expect(reading(kpi.id, '2020-01-01', 10_000_000_000)).rejects.toMatchObject({
    cause: { code: '22003' },
  });
  await expect(target(kpi.id, 2026, 1, -10_000_000_000)).rejects.toMatchObject({
    cause: { code: '22003' },
  });
  await expect(target(kpi.id, 2026, 2, -9_999_999_999.9999)).resolves.toBeTruthy();
});
it('KPIS-B01 KPIS-B06 the database holds the direction, cadence and unit a KPI is read by', async () => {
  const insert = (column: string, value: string) =>
    db().execute(
      sql.raw(
        `insert into kpis (id, name, ${column}) values (gen_random_uuid(), 'Checked', ${value})`,
      ),
    );
  await expect(insert('direction', `'sideways'`)).rejects.toMatchObject({
    cause: { constraint: 'kpis_direction_check' },
  });
  await expect(insert('frequency', `'weekly'`)).rejects.toMatchObject({
    cause: { constraint: 'kpis_frequency_check' },
  });
  await expect(insert('unit', `'widgets'`)).rejects.toMatchObject({
    cause: { constraint: 'kpis_unit_check' },
  });
  await expect(insert('direction', `'lower'`)).resolves.toBeTruthy();
});
it('KPIS-I03 a KPI cannot be hard-deleted while its children exist except by cascade', async () => {
  const today = await workspaceToday();
  const kpi = await harness.kpi('Cascading');
  await reading(kpi.id, today);
  await target(kpi.id, 2026, 1);
  await db().execute(sql`delete from kpis where id = ${kpi.id}::uuid`);
  const rows = await db().execute<{ count: string }>(
    sql`select (select count(*) from kpi_readings) + (select count(*) from kpi_targets) as count`,
  );
  expect(rows.rows[0]?.count).toBe('0');
});
