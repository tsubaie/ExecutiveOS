// A scorecard small enough to read at a glance and wide enough to exercise every state the list
// has to tell apart: on target, near target, off target, no data, stale, and no target at all,
// in both directions and both scripts. Invented measures only (docs/03 § Seed data).
export type SeedReading = { daysAgo: number; value: number };
export type SeedTarget = { quartersAhead: number; value: number };
export type SeedKpi = {
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  category: string;
  teams: string[];
  notes: string;
  underObjective: boolean;
  readings: SeedReading[];
  targets: SeedTarget[];
};
export const seedObjective = {
  name: 'Deliver the 2026 strategy',
  description: 'The measures the principal reviews before every board cycle.',
};
export const seedKpis: SeedKpi[] = [
  {
    name: 'Board decisions implemented',
    unit: '%',
    direction: 'higher',
    category: 'Governance',
    teams: ['Secretariat'],
    notes: 'Share of decisions closed within the cycle they were taken in.',
    underObjective: true,
    readings: [
      { daysAgo: 84, value: 72 },
      { daysAgo: 63, value: 78 },
      { daysAgo: 42, value: 84 },
      { daysAgo: 17, value: 91 },
    ],
    targets: [{ quartersAhead: 0, value: 90 }],
  },
  {
    name: 'Average days to close an action',
    unit: 'days',
    direction: 'lower',
    category: 'Delivery',
    teams: ['Operations'],
    notes: '',
    underObjective: true,
    readings: [
      { daysAgo: 84, value: 21 },
      { daysAgo: 63, value: 18 },
      { daysAgo: 42, value: 16 },
      { daysAgo: 17, value: 14 },
    ],
    targets: [{ quartersAhead: 0, value: 12 }],
  },
  {
    name: 'Strategic budget committed',
    unit: '%',
    direction: 'higher',
    category: 'Finance',
    teams: ['Finance'],
    notes: '',
    underObjective: true,
    readings: [
      { daysAgo: 84, value: 41 },
      { daysAgo: 63, value: 44 },
      { daysAgo: 42, value: 46 },
      { daysAgo: 17, value: 48 },
    ],
    targets: [{ quartersAhead: 0, value: 75 }],
  },
  {
    name: 'رضا الشركاء',
    unit: 'نقطة',
    direction: 'higher',
    category: 'External',
    teams: ['Partnerships'],
    notes: 'لم تُسجَّل قراءة بعد؛ المسح السنوي قادم.',
    underObjective: true,
    readings: [],
    targets: [{ quartersAhead: 0, value: 8 }],
  },
  {
    name: 'التغطية الإقليمية',
    unit: 'موقعًا',
    direction: 'higher',
    category: 'Delivery',
    teams: ['Operations'],
    notes: '',
    underObjective: true,
    readings: [{ daysAgo: 260, value: 12 }],
    targets: [{ quartersAhead: 0, value: 20 }],
  },
  {
    name: 'Digital service uptake',
    unit: '%',
    direction: 'higher',
    category: 'Delivery',
    teams: ['Digital'],
    notes: 'Measured, but nobody has agreed what good looks like yet.',
    underObjective: true,
    readings: [
      { daysAgo: 50, value: 31 },
      { daysAgo: 22, value: 37 },
    ],
    targets: [],
  },
  {
    name: 'Cost per served case',
    unit: 'SAR',
    direction: 'lower',
    category: 'Finance',
    teams: ['Finance', 'Operations'],
    notes: 'Filed under no objective on purpose, so the facet has something to exclude.',
    underObjective: false,
    readings: [
      { daysAgo: 70, value: 480 },
      { daysAgo: 35, value: 455 },
      { daysAgo: 9, value: 442 },
    ],
    // Next quarter only: the effective target is the earliest one ahead, and the row says so.
    targets: [{ quartersAhead: 1, value: 400 }],
  },
];
