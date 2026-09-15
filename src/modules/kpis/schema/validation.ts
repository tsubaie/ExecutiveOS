import { z } from 'zod';
import { periodIndex, periodOf, periodsBehind, shiftPeriod, type Period } from '@/core/time/kpis';
import type { StatusThresholds } from '@/core/config/settings';
export const Direction = z.enum(['higher', 'lower']);
export type Direction = z.infer<typeof Direction>;
// The cadence a KPI is reported on. It decides what a period is everywhere: the target a reading is
// measured against, the label on the trend's axis, the steps of the record's comparison toggle, and
// how long a reading stays current.
export const Frequency = z.enum(['monthly', 'quarterly', 'annual']);
export type Frequency = z.infer<typeof Frequency>;
// A closed list, so a value always carries a symbol a reader recognizes rather than free text
// somebody has to spell the same way twice.
export const Unit = z.enum(['count', 'percent', 'sar', 'usd', 'points']);
export type Unit = z.infer<typeof Unit>;
export const PeriodRef = z.object({
  year: z.number().int(),
  period: z.number().int().min(1).max(12),
});
// KPIS-B01: "off target" and "no data" are different answers, so the status enum keeps them apart.
export const KpiStatus = z.enum([
  'on_target',
  'near_target',
  'off_target',
  'no_data',
  'stale',
  'no_target',
]);
export type KpiStatus = z.infer<typeof KpiStatus>;
export const View = z.enum([
  'all',
  'attention',
  'on_target',
  'near_target',
  'off_target',
  'no_data',
  'stale',
  'no_target',
  'trash',
]);
export const Sort = z.enum(['default', 'name', 'change']);
export const ComparePeriod = z.enum(['', 'previous', 'next']); // KPIS-B26; '' is the effective one
// docs/03 § Numbers: numeric(14,4) with an absolute value under 10^10, so the value survives the
// JSON boundary exactly. Rounding here keeps the stored value and the validated value identical.
const Amount = z
  .number()
  .gt(-10000000000)
  .lt(10000000000)
  .transform((value) => Math.round(value * 10000) / 10000);
const timestamp = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString() : value),
  z.iso.datetime({ offset: true }),
);
export const ObjectiveCreate = z.strictObject({
  name: z.string().trim().min(1).max(500),
  description: z.string().max(50000).default(''),
});
export type ObjectiveCreate = z.infer<typeof ObjectiveCreate>;
export const ObjectivePatch = z.strictObject({
  name: ObjectiveCreate.shape.name.optional(),
  description: z.string().max(50000).optional(),
  revision: z.number().int().positive(),
});
export type ObjectivePatch = z.infer<typeof ObjectivePatch>;
export const Objective = ObjectiveCreate.extend({
  id: z.uuid(),
  revision: z.number().int(),
  sortOrder: z.number().int(),
  kpiCount: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(),
  deletedOpId: z.uuid().nullable(),
}).strip();
export type Objective = z.infer<typeof Objective>;
export const ObjectiveList = z.object({ data: z.array(Objective) });
export const KpiCreate = z.strictObject({
  name: z.string().trim().min(1).max(500),
  unit: Unit.default('count'),
  direction: Direction.default('higher'),
  category: z.string().trim().max(100).default(''),
  objectiveId: z.uuid().nullable().default(null),
  ownerId: z.uuid().nullable().default(null),
  notes: z.string().max(50000).default(''),
  frequency: Frequency.default('quarterly'),
});
export type KpiCreate = z.infer<typeof KpiCreate>;
export const KpiPatch = z.strictObject({
  name: KpiCreate.shape.name.optional(),
  unit: Unit.optional(),
  direction: Direction.optional(),
  category: z.string().trim().max(100).optional(),
  objectiveId: z.uuid().nullable().optional(),
  ownerId: z.uuid().nullable().optional(),
  notes: z.string().max(50000).optional(),
  frequency: Frequency.optional(),
  revision: z.number().int().positive(),
});
export type KpiPatch = z.infer<typeof KpiPatch>;
export const Point = z.object({ date: z.iso.date(), value: z.number() });
export type Point = z.infer<typeof Point>;
// Everything the row and the gauge read, computed once per request (statuses are never stored).
export const KpiMeta = z.object({
  current: z.number().nullable(),
  currentDate: z.iso.date().nullable(),
  previous: z.number().nullable(),
  percentChange: z.number().nullable(),
  effectiveTarget: z.number().nullable(),
  effectiveTargetPeriod: PeriodRef.nullable(),
  status: KpiStatus,
  achievement: z.number().nullable(),
  sparkline: z.array(Point),
});
export type KpiMeta = z.infer<typeof KpiMeta>;
export const Kpi = KpiCreate.extend({
  id: z.uuid(),
  revision: z.number().int(),
  sortOrder: z.number().int(),
  objectiveName: z.string().nullable(),
  objectiveDeleted: z.boolean(),
  ownerName: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(),
  deletedOpId: z.uuid().nullable(),
  meta: KpiMeta,
}).strip();
export type Kpi = z.infer<typeof Kpi>;
export const Reading = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  readingDate: z.iso.date(),
  value: z.number(),
  note: z.string(),
  future: z.boolean(),
  createdAt: timestamp,
});
export type Reading = z.infer<typeof Reading>;
export const Target = z.object({
  id: z.uuid(),
  year: z.number().int(),
  period: z.number().int().min(1).max(12),
  targetValue: z.number(),
});
export type Target = z.infer<typeof Target>;
export const PeriodComparison = PeriodRef.extend({
  value: z.number().nullable(),
  target: z.number().nullable(),
});
// KPIS-B08: the three periods around the one the KPI is measured against, so the record can be read
// against the period before it and the one after it without another request. The middle entry is
// the effective period, and it repeats the row's own answer exactly.
export const PeriodView = PeriodRef.extend({
  target: z.number().nullable(),
  achievement: z.number().nullable(),
  status: KpiStatus,
});
export type PeriodView = z.infer<typeof PeriodView>;
export const KpiDetail = Kpi.extend({
  readings: z.array(Reading),
  targets: z.array(Target),
  previousPeriod: PeriodComparison.nullable(),
  periods: z.array(PeriodView),
});
export type KpiDetail = z.infer<typeof KpiDetail>;
export const KpiListQuery = z.strictObject({
  view: View.default('all'),
  q: z.string().max(500).default(''),
  objectiveId: z.string().max(100).default(''),
  category: z.string().max(100).default(''),
  ownerId: z.string().max(100).default(''),
  period: ComparePeriod.default(''),
  sort: Sort.default('default'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(4000).optional(),
});
export type KpiListQuery = z.infer<typeof KpiListQuery>;
export const KpiList = z.object({
  data: z.array(Kpi),
  meta: z.object({
    counts: z.record(z.string(), z.number()),
    nextCursor: z.string().nullable(),
  }),
});
const Named = z.object({ id: z.uuid(), name: z.string() });
export const KpiFacets = z.object({
  categories: z.array(z.string()),
  owners: z.array(Named),
  objectives: z.array(Named),
});
export const ReadingCreate = z.strictObject({
  readingDate: z.iso.date(),
  value: Amount,
  note: z.string().trim().max(2000).default(''),
});
export type ReadingCreate = z.infer<typeof ReadingCreate>;
export const ReadingUpsert = z.strictObject({
  value: Amount,
  note: z.string().trim().max(2000).default(''),
});
export const ReadingPatch = z.strictObject({
  value: Amount.optional(),
  note: z.string().trim().max(2000).optional(),
  revision: z.number().int().positive(),
});
export type ReadingPatch = z.infer<typeof ReadingPatch>;
export const TargetsPut = z.strictObject({
  items: z
    .array(
      z.strictObject({
        year: z.number().int().min(1900).max(2999),
        period: z.number().int().min(1).max(12),
        targetValue: Amount,
      }),
    )
    .min(1)
    .max(40)
    .refine(
      (items) => new Set(items.map((item) => `${item.year}-${item.period}`)).size === items.length,
      { error: 'duplicate_period' },
    ),
});
export type TargetsPut = z.infer<typeof TargetsPut>;
export const TargetList = z.object({ data: z.array(Target) });
export const ReadingList = z.object({ data: z.array(Reading) });
export const Revision = z.strictObject({ revision: z.number().int().positive() });
export const Reorder = z.strictObject({
  items: z
    .array(z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }))
    .min(1)
    .max(200)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});
export const KpiReference = z.object({ id: z.uuid(), name: z.string(), deleted: z.boolean() });

// ── The scorecard's arithmetic ────────────────────────────────────────────────────────────────
// KPIS-B01–B04 are pure functions of facts the repo reads, so they live beside the schemas that
// name those facts: one definition shared by the list, the detail, Home and the tests, with no
// database or request in scope. Statuses are never stored; every read recomputes them.
export type PeriodTarget = { year: number; period: number; value: number };
export type StatusInput = {
  current: number | null;
  currentDate: string | null;
  target: number | null;
  direction: Direction;
  frequency: Frequency;
  thresholds: StatusThresholds;
  today: string;
};
const meets = (current: number, target: number, direction: Direction) =>
  direction === 'higher' ? current >= target : current <= target;
// The ratio bands, read in the direction the KPI is meant to move.
function banded(
  ratio: number,
  direction: Direction,
  band: { on: number; near: number },
): KpiStatus {
  const inside = direction === 'higher' ? ratio >= band.on : ratio <= band.on;
  const close = direction === 'higher' ? ratio >= band.near : ratio <= band.near;
  return inside ? 'on_target' : close ? 'near_target' : 'off_target';
}
export function computeKpiStatus(input: StatusInput): KpiStatus {
  const { current, currentDate, target, direction, thresholds } = input;
  if (current === null || currentDate === null) return 'no_data';
  // One missed report is lag; more than one is nobody maintaining the measure (KPIS-B01).
  if (periodsBehind(currentDate, input.today, input.frequency) > 1) return 'stale';
  if (target === null) return 'no_target';
  // A ratio only carries meaning when both sides share a sign and the target is not zero. Without
  // one there is no "near" band to fall into, so the reading is simply on the right side or not.
  if (target === 0 || Math.sign(current) !== Math.sign(target))
    return meets(current, target, direction) ? 'on_target' : 'off_target';
  return banded(current / target, direction, thresholds[direction]);
}
// KPIS-B03: 100 percent means on target in both directions, so the ratio inverts with the
// direction. It is undefined where a ratio would be meaningless, and the gauge then shows the
// status badge alone.
export function achievementOf(current: number | null, target: number | null, direction: Direction) {
  if (current === null || target === null || target <= 0 || current <= 0) return null;
  return Math.min(direction === 'higher' ? current / target : target / current, 9.99);
}
export function percentChangeOf(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
// KPIS-B02: the current period's target, else the earliest future one, else none.
export function resolveEffectiveTarget(
  targets: PeriodTarget[],
  period: Period,
  frequency: Frequency,
) {
  const now = periodIndex(period, frequency);
  const chosen = targets
    .filter((target) => periodIndex(target, frequency) >= now)
    .sort((a, b) => periodIndex(a, frequency) - periodIndex(b, frequency))[0];
  return chosen ? { value: chosen.value, year: chosen.year, period: chosen.period } : null;
}
// Everything the row, the gauge and Home read, derived in one place from the facts the repository
// reads (KPIS-B01–B05). Statuses are never stored: a threshold change or a new period changes
// every answer, so each read recomputes them (KPIS-B10, KPIS-B11).
export type KpiFacts = {
  direction: string;
  frequency: string;
  current: Point | null;
  previous: number | null;
  sparkline: Point[];
  targets: PeriodTarget[];
};
// The period is not part of the measurement context: each KPI is on its own cadence, so it is
// derived from the day and that KPI's frequency wherever it is needed.
export type MeasuredAt = { today: string; thresholds: StatusThresholds; offset?: number };
export function deriveMeta(facts: KpiFacts, at: MeasuredAt): KpiMeta {
  const current = facts.current?.value ?? null;
  const currentDate = facts.current?.date ?? null;
  const direction = Direction.parse(facts.direction);
  const frequency = Frequency.parse(facts.frequency);
  // KPIS-B26: `at.offset` reads the whole scorecard against a neighbouring period, named exactly
  // and without freshness, for the reasons the spec gives.
  const period = shiftPeriod(periodOf(at.today, frequency), at.offset ?? 0, frequency);
  const target = at.offset
    ? (facts.targets.find((row) => row.year === period.year && row.period === period.period) ?? null)
    : resolveEffectiveTarget(facts.targets, period, frequency);
  const value = target?.value ?? null;
  return {
    current,
    currentDate,
    previous: facts.previous,
    percentChange: percentChangeOf(current, facts.previous),
    effectiveTarget: value,
    effectiveTargetPeriod: target ? { year: target.year, period: target.period } : null,
    status: computeKpiStatus({
      current,
      currentDate: at.offset ? at.today : currentDate,
      target: value,
      direction,
      frequency,
      thresholds: at.thresholds,
      today: at.today,
    }),
    achievement: achievementOf(current, value, direction),
    sparkline: facts.sparkline,
  };
}
// KPIS-B08: what the record would read as against the period before the effective one and the one
// after it. Freshness is deliberately not applied to the neighbours: the question they answer is
// "was this target met", which does not go stale, and the middle entry carries the KPI's own status
// so the record and the row never disagree.
export function derivePeriods(
  facts: KpiFacts,
  at: MeasuredAt,
  base: Period,
  status: KpiStatus,
  previousReading: number | null,
) {
  const direction = Direction.parse(facts.direction);
  const frequency = Frequency.parse(facts.frequency);
  const current = facts.current?.value ?? null;
  const targetIn = ({ year, period }: Period) =>
    facts.targets.find((row) => row.year === year && row.period === period)?.value ?? null;
  const before = shiftPeriod(periodOf(at.today, frequency), -1, frequency);
  return {
    periods: [-1, 0, 1].map((offset) => {
      const at_ = shiftPeriod(base, offset, frequency);
      const target = targetIn(at_);
      return {
        ...at_,
        target,
        achievement: achievementOf(current, target, direction),
        status:
          offset === 0
            ? status
            : computeKpiStatus({
                current,
                currentDate: at.today,
                target,
                direction,
                frequency,
                thresholds: at.thresholds,
                today: at.today,
              }),
      };
    }),
    // KPIS-B04: the period before this one, read at its own last reading rather than at today's.
    previousPeriod: { ...before, value: previousReading, target: targetIn(before) },
  };
}
// KPIS-B07: the default sort puts what needs attention first. "No target" outranks "on target"
// because a KPI nobody has set a target for is unanswered, not healthy.
export const severityRank: Record<KpiStatus, number> = {
  off_target: 0,
  stale: 1,
  no_data: 2,
  near_target: 3,
  no_target: 4,
  on_target: 5,
};
export const attentionStatuses: readonly KpiStatus[] = ['off_target', 'stale', 'no_data'];
