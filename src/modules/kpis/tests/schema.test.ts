import { describe, expect, it } from 'vitest';
import { StatusThresholds } from '@/core/config/settings';
import { dayAt } from '@/core/time/days';
import { periodOf, periodRange, periodsBehind, shiftPeriod } from '@/core/time/kpis';
import { extremeZones } from '../../../../tests/fixtures/timezones';
import {
  computeKpiStatus,
  achievementOf,
  percentChangeOf,
  resolveEffectiveTarget,
  deriveMeta,
  KpiCreate,
  ReadingCreate,
  TargetsPut,
  type Direction,
  type StatusInput,
} from '../schema/validation';
const thresholds = StatusThresholds.parse({
  higher: { on: 0.99, near: 0.85 },
  lower: { on: 1.01, near: 1.18 },
});
const TODAY = '2026-09-10';
const status = (input: Partial<StatusInput> & { current: number | null; target: number | null }) =>
  computeKpiStatus({
    currentDate: TODAY,
    direction: 'higher',
    frequency: 'quarterly',
    thresholds,
    today: TODAY,
    ...input,
  });
describe('KPIS-B01 KPIS-A01 the status bands run in the direction the KPI is meant to move', () => {
  const cases: [Direction, number, string][] = [
    ['higher', 100, 'on_target'],
    ['higher', 99, 'on_target'],
    ['higher', 98.9999, 'near_target'],
    ['higher', 85, 'near_target'],
    ['higher', 84.9999, 'off_target'],
    ['higher', 84, 'off_target'],
    ['lower', 100, 'on_target'],
    ['lower', 101, 'on_target'],
    ['lower', 101.0001, 'near_target'],
    ['lower', 118, 'near_target'],
    ['lower', 118.0001, 'off_target'],
    ['lower', 119, 'off_target'],
  ];
  it.each(cases)(
    'KPIS-B01 KPIS-A01 %s at %d reads %s against a target of 100',
    (direction, current, expected) => {
      expect(status({ current, target: 100, direction })).toBe(expected);
    },
  );
});
it('KPIS-B01 KPIS-A02 a missing, stale or untargeted reading is named rather than scored', () => {
  expect(status({ current: null, target: 100 })).toBe('no_data');
  expect(status({ current: 100, currentDate: null, target: 100 })).toBe('no_data');
  // One missed report is lag, two is nobody maintaining it: on 2026-09-10 a quarterly KPI read in
  // Q2 is still current and one read in Q1 is not.
  expect(status({ current: 100, target: 100, currentDate: '2026-05-13' })).toBe('on_target');
  expect(status({ current: 100, target: 100, currentDate: '2026-03-31' })).toBe('stale');
  // A monthly measure falls behind four times faster, an annual one four times slower.
  const monthly = { frequency: 'monthly' as const, current: 100, target: 100 };
  expect(status({ ...monthly, currentDate: '2026-08-01' })).toBe('on_target');
  expect(status({ ...monthly, currentDate: '2026-07-31' })).toBe('stale');
  expect(
    status({ current: 100, target: 100, frequency: 'annual', currentDate: '2025-01-02' }),
  ).toBe('on_target');
  expect(
    status({ current: 100, target: 100, frequency: 'annual', currentDate: '2024-12-31' }),
  ).toBe('stale');
  expect(status({ current: 100, target: null })).toBe('no_target');
  // Freshness is checked before the target, so a stale reading never reads as "no target".
  expect(status({ current: 100, target: null, currentDate: '2026-01-01' })).toBe('stale');
});
it('KPIS-B01 KPIS-A03 a zero or opposite-signed target has no near band', () => {
  expect(status({ current: 0, target: 0, direction: 'lower' })).toBe('on_target');
  expect(status({ current: 3, target: 0, direction: 'lower' })).toBe('off_target');
  expect(status({ current: 0, target: 0, direction: 'higher' })).toBe('on_target');
  expect(status({ current: -5, target: 10, direction: 'higher' })).toBe('off_target');
  expect(status({ current: 5, target: -10, direction: 'higher' })).toBe('on_target');
  expect(status({ current: 0, target: 10, direction: 'higher' })).toBe('off_target');
  // Both negative: the ratio is meaningful again, so the bands apply.
  expect(status({ current: -99, target: -100, direction: 'higher' })).toBe('on_target');
});
it('KPIS-B02 the effective target is this period, else the earliest one after it', () => {
  const period = { year: 2026, period: 3 };
  const targets = [
    { year: 2026, period: 2, value: 50 },
    { year: 2026, period: 3, value: 100 },
    { year: 2026, period: 4, value: 120 },
  ];
  const pick = (rows: typeof targets) => resolveEffectiveTarget(rows, period, 'quarterly');
  expect(pick(targets)).toEqual({ value: 100, year: 2026, period: 3 });
  expect(pick(targets.filter((row) => row.period !== 3))).toEqual({
    value: 120,
    year: 2026,
    period: 4,
  });
  expect(pick([{ year: 2027, period: 1, value: 7 }])).toEqual({ value: 7, year: 2027, period: 1 });
  expect(pick([{ year: 2026, period: 2, value: 50 }])).toBeNull();
  expect(pick([])).toBeNull();
});
it('KPIS-B02 periods follow the workspace timezone and the KPI cadence across every boundary', () => {
  // The same instant is Q4 in the east and still Q3 in the west.
  const boundary = '2026-09-30T12:00:00Z';
  expect(periodOf(dayAt(extremeZones.east, boundary), 'quarterly')).toEqual({
    year: 2026,
    period: 4,
  });
  expect(periodOf(dayAt(extremeZones.west, boundary), 'quarterly')).toEqual({
    year: 2026,
    period: 3,
  });
  const newYear = '2026-12-31T12:00:00Z';
  expect(periodOf(dayAt(extremeZones.east, newYear), 'monthly')).toEqual({ year: 2027, period: 1 });
  expect(periodOf(dayAt(extremeZones.west, newYear), 'monthly')).toEqual({
    year: 2026,
    period: 12,
  });
  expect(periodOf('2026-09-10', 'annual')).toEqual({ year: 2026, period: 1 });
  // A period steps and wraps at its own cadence.
  expect(shiftPeriod({ year: 2026, period: 1 }, -1, 'quarterly')).toEqual({
    year: 2025,
    period: 4,
  });
  expect(shiftPeriod({ year: 2026, period: 12 }, 1, 'monthly')).toEqual({ year: 2027, period: 1 });
  expect(shiftPeriod({ year: 2026, period: 1 }, 1, 'annual')).toEqual({ year: 2027, period: 1 });
  expect(periodRange({ year: 2026, period: 1 }, 'quarterly')).toEqual({
    from: '2026-01-01',
    to: '2026-03-31',
  });
  expect(periodRange({ year: 2026, period: 2 }, 'monthly')).toEqual({
    from: '2026-02-01',
    to: '2026-02-28',
  });
  expect(periodRange({ year: 2026, period: 1 }, 'annual')).toEqual({
    from: '2026-01-01',
    to: '2026-12-31',
  });
  expect(periodsBehind('2026-06-30', '2026-09-10', 'quarterly')).toBe(1);
  expect(periodsBehind('2026-09-10', '2026-09-10', 'monthly')).toBe(0);
});
it('KPIS-B03 achievement reads 100 percent as on target in both directions and caps its display', () => {
  expect(achievementOf(80, 100, 'higher')).toBeCloseTo(0.8);
  expect(achievementOf(80, 100, 'lower')).toBeCloseTo(1.25);
  expect(achievementOf(100000, 10, 'higher')).toBe(9.99);
  expect(achievementOf(null, 100, 'higher')).toBeNull();
  expect(achievementOf(50, null, 'higher')).toBeNull();
  expect(achievementOf(50, 0, 'lower')).toBeNull();
  expect(achievementOf(50, -10, 'higher')).toBeNull();
  expect(achievementOf(0, 10, 'higher')).toBeNull();
});
it('KPIS-B04 percent change is undefined without a previous reading or against zero', () => {
  expect(percentChangeOf(120, 100)).toBeCloseTo(0.2);
  expect(percentChangeOf(80, -100)).toBeCloseTo(1.8);
  expect(percentChangeOf(120, 0)).toBeNull();
  expect(percentChangeOf(120, null)).toBeNull();
  expect(percentChangeOf(null, 100)).toBeNull();
});
it('KPIS-B05 KPIS-B04 the derived meta carries the series, the change and the chosen target', () => {
  const meta = deriveMeta(
    {
      direction: 'higher',
      frequency: 'quarterly',
      current: { date: '2026-09-09', value: 90 },
      // The reading before this one and the last reading of the period before it are different
      // numbers whenever a measure is read more often than it is reported. The change a scorecard
      // states is the one against the period (KPIS-B04), so 80 is never what it compares to.
      previous: 80,
      previousPeriodValue: 75,
      sparkline: [
        { date: '2026-08-09', value: 75 },
        { date: '2026-09-09', value: 90 },
      ],
      targets: [{ year: 2026, period: 3, value: 100 }],
    },
    { today: TODAY, thresholds },
  );
  expect(meta).toMatchObject({
    current: 90,
    currentDate: '2026-09-09',
    previous: 75,
    effectiveTarget: 100,
    effectiveTargetPeriod: { year: 2026, period: 3 },
    status: 'near_target',
  });
  expect(meta.percentChange).toBeCloseTo(0.2);
  expect(meta.achievement).toBeCloseTo(0.9);
  expect(meta.sparkline).toHaveLength(2);
});
it('KPIS-I04 thresholds are rejected when a band is ordered against its direction', () => {
  expect(
    StatusThresholds.safeParse({ higher: { on: 0.8, near: 0.9 }, lower: { on: 1, near: 2 } })
      .success,
  ).toBe(false);
  expect(
    StatusThresholds.safeParse({ higher: { on: 1, near: 0.9 }, lower: { on: 2, near: 1 } }).success,
  ).toBe(false);
  expect(
    StatusThresholds.safeParse({ higher: { on: 1, near: 1 }, lower: { on: 1, near: 1 } }).success,
  ).toBe(true);
});
it('KPIS-B09 reading and target inputs hold the documented ranges', () => {
  expect(ReadingCreate.parse({ readingDate: TODAY, value: 1.23456 }).value).toBe(1.2346);
  expect(ReadingCreate.safeParse({ readingDate: TODAY, value: 1e10 }).success).toBe(false);
  expect(ReadingCreate.safeParse({ readingDate: '10-09-2026', value: 1 }).success).toBe(false);
  expect(
    TargetsPut.safeParse({ items: [{ year: 2026, period: 13, targetValue: 1 }] }).success,
  ).toBe(false);
  expect(
    TargetsPut.safeParse({
      items: [
        { year: 2026, period: 1, targetValue: 1 },
        { year: 2026, period: 1, targetValue: 2 },
      ],
    }).success,
  ).toBe(false);
  expect(
    TargetsPut.safeParse({ items: [{ year: 2026, period: 12, targetValue: -5 }] }).success,
  ).toBe(true);
});
it('KPIS-B07 a KPI draft trims its name and defaults the rest of the definition', () => {
  const draft = KpiCreate.parse({ name: '  Revenue  ' });
  expect(draft).toMatchObject({
    name: 'Revenue',
    direction: 'higher',
    unit: 'count',
    frequency: 'quarterly',
  });
  expect(draft.ownerId).toBeNull();
  expect(KpiCreate.safeParse({ name: '   ' }).success).toBe(false);
  // Both are closed lists, so a value outside them never reaches the database.
  expect(KpiCreate.safeParse({ name: 'x', unit: 'widgets' }).success).toBe(false);
  expect(KpiCreate.safeParse({ name: 'x', frequency: 'weekly' }).success).toBe(false);
});
