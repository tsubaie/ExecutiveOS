import { describe, expect, it } from 'vitest';
import { StatusThresholds } from '@/core/config/settings';
import { dayAt } from '@/core/time/days';
import { quarterOf, quarterRange, previousQuarter, quarterLabel } from '@/core/time/kpis';
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
    freshnessDays: 120,
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
  // "Older than freshness": a reading exactly that many days old is still current.
  expect(status({ current: 100, target: 100, currentDate: '2026-05-13' })).toBe('on_target');
  expect(status({ current: 100, target: 100, currentDate: '2026-05-12' })).toBe('stale');
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
it('KPIS-B02 the effective target is this quarter, else the earliest one after it', () => {
  const quarter = { year: 2026, quarter: 3 };
  const targets = [
    { year: 2026, quarter: 2, value: 50 },
    { year: 2026, quarter: 3, value: 100 },
    { year: 2026, quarter: 4, value: 120 },
  ];
  expect(resolveEffectiveTarget(targets, quarter)).toEqual({ value: 100, label: '2026-Q3' });
  expect(
    resolveEffectiveTarget(
      targets.filter((t) => t.quarter !== 3),
      quarter,
    ),
  ).toEqual({
    value: 120,
    label: '2026-Q4',
  });
  expect(resolveEffectiveTarget([{ year: 2027, quarter: 1, value: 7 }], quarter)).toEqual({
    value: 7,
    label: '2027-Q1',
  });
  expect(resolveEffectiveTarget([{ year: 2026, quarter: 2, value: 50 }], quarter)).toBeNull();
  expect(resolveEffectiveTarget([], quarter)).toBeNull();
});
it('KPIS-B02 quarters follow the workspace timezone across quarter and year boundaries', () => {
  // The same instant is Q4 in the east and still Q3 in the west.
  const boundary = '2026-09-30T12:00:00Z';
  expect(quarterOf(dayAt(extremeZones.east, boundary))).toEqual({ year: 2026, quarter: 4 });
  expect(quarterOf(dayAt(extremeZones.west, boundary))).toEqual({ year: 2026, quarter: 3 });
  const newYear = '2026-12-31T12:00:00Z';
  expect(quarterOf(dayAt(extremeZones.east, newYear))).toEqual({ year: 2027, quarter: 1 });
  expect(quarterOf(dayAt(extremeZones.west, newYear))).toEqual({ year: 2026, quarter: 4 });
  expect(previousQuarter({ year: 2026, quarter: 1 })).toEqual({ year: 2025, quarter: 4 });
  expect(quarterRange({ year: 2026, quarter: 1 })).toEqual({
    from: '2026-01-01',
    to: '2026-03-31',
  });
  expect(quarterRange({ year: 2026, quarter: 4 })).toEqual({
    from: '2026-10-01',
    to: '2026-12-31',
  });
  expect(quarterLabel({ year: 2026, quarter: 2 })).toBe('2026-Q2');
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
      freshnessDays: 120,
      current: { date: '2026-09-09', value: 90 },
      previous: 75,
      sparkline: [
        { date: '2026-08-09', value: 75 },
        { date: '2026-09-09', value: 90 },
      ],
      targets: [{ year: 2026, quarter: 3, value: 100 }],
    },
    { today: TODAY, quarter: { year: 2026, quarter: 3 }, thresholds },
  );
  expect(meta).toMatchObject({
    current: 90,
    currentDate: '2026-09-09',
    previous: 75,
    effectiveTarget: 100,
    effectiveTargetLabel: '2026-Q3',
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
    TargetsPut.safeParse({ items: [{ year: 2026, quarter: 5, targetValue: 1 }] }).success,
  ).toBe(false);
  expect(
    TargetsPut.safeParse({
      items: [
        { year: 2026, quarter: 1, targetValue: 1 },
        { year: 2026, quarter: 1, targetValue: 2 },
      ],
    }).success,
  ).toBe(false);
  expect(
    TargetsPut.safeParse({ items: [{ year: 2026, quarter: 1, targetValue: -5 }] }).success,
  ).toBe(true);
});
it('KPIS-B07 a KPI draft normalizes its teams and keeps the first spelling', () => {
  const draft = KpiCreate.parse({ name: '  Revenue  ', teams: ['Finance', 'finance', 'Ops'] });
  expect(draft).toMatchObject({ name: 'Revenue', direction: 'higher', freshnessDays: 120 });
  expect(draft.teams).toEqual(['Finance', 'Ops']);
  expect(KpiCreate.safeParse({ name: '   ' }).success).toBe(false);
  expect(KpiCreate.safeParse({ name: 'x', freshnessDays: 0 }).success).toBe(false);
});
