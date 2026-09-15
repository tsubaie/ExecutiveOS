// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import ar from '@/core/i18n/messages/ar.json';
import {
  KpiDetail,
  type KpiMeta,
  type KpiStatus,
  type Reading,
  type Target,
} from '../../schema/validation';
import { KpiCard } from '../../ui/KpiCard';
import { KpiHeadline, KpiSummary, LatestNote } from '../../ui/KpiHeadline';
import { KpiTrend } from '../../ui/KpiTrend';
import { KpiTargets } from '../../ui/KpiTargets';
import { mount } from './harness';
const base = {
  id: '01a08a9f-1991-760a-b73a-568f6f866500',
  revision: 2,
  name: 'Net promoter score',
  unit: 'points',
  direction: 'higher',
  frequency: 'quarterly',
  category: 'Service',
  objectiveId: null,
  objectiveName: 'Grow the base',
  objectiveDeleted: false,
  ownerId: null,
  ownerName: null,
  notes: '',
  sortOrder: 0,
  createdAt: '2026-09-01T07:00:00.000Z',
  updatedAt: '2026-09-01T07:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedOpId: null,
  readings: [] as Reading[],
  targets: [] as Target[],
  previousPeriod: null,
};
// The three quarters the record can be read against; the middle one repeats the row's answer.
const periodsFor = (meta: KpiMeta) => [
  { year: 2026, period: 2, target: 40, achievement: 1.06, status: 'on_target' },
  {
    ...(meta.effectiveTargetPeriod ?? { year: 2026, period: 3 }),
    target: meta.effectiveTarget,
    achievement: meta.achievement,
    status: meta.status,
  },
  { year: 2026, period: 4, target: 60, achievement: 0.71, status: 'off_target' },
];
const meta: KpiMeta = {
  current: 42.5,
  currentDate: '2026-09-09',
  previous: 34,
  percentChange: 0.25,
  effectiveTarget: 50,
  effectiveTargetPeriod: { year: 2026, period: 3 },
  status: 'near_target',
  achievement: 0.85,
  sparkline: [
    { date: '2026-08-09', value: 34 },
    { date: '2026-09-09', value: 42.5 },
  ],
};
const kpi = (overrides: Partial<typeof base> = {}, metaOverrides: Partial<KpiMeta> = {}) => {
  const derived = { ...meta, ...metaOverrides };
  return KpiDetail.parse({
    ...base,
    periods: periodsFor(derived),
    ...overrides,
    meta: derived,
  });
};
it('KPIS-B07 a tile states its status in words and pairs every figure with its unit', () => {
  mount(<KpiCard kpi={kpi()} />);
  expect(screen.getByText(en.kpis.near_target)).toBeTruthy();
  expect(screen.getByText('Net promoter score')).toBeTruthy();
  expect(screen.getByText('42.5 pts')).toBeTruthy();
  expect(screen.getByText('+25%')).toBeTruthy();
  // The objective it serves is the one piece of filing the tile keeps; the owner is read in the
  // record, not from a column of proper nouns between the eye and the figures.
  expect(screen.getByText('Grow the base')).toBeTruthy();
  expect(screen.queryByText(en.kpis.noOwner)).toBeNull();
});
it('KPIS-B07 a tile says how far through the target the measure is, as a mark and as a figure', () => {
  const { container } = mount(<KpiCard kpi={kpi()} />);
  expect(screen.getByText('85%')).toBeTruthy();
  expect(screen.getByText('Target 50 pts · Q3 2026')).toBeTruthy();
  // Two arcs in the one mark: the track the measure is read against, and how far along it it is.
  const fill = container.querySelector('.meter-arc');
  const track = fill?.parentElement?.querySelector('path');
  expect(fill?.getAttribute('d')).not.toBe(track?.getAttribute('d'));
});
it('KPIS-B07 past its target the arc stays full, the way the record gauge does', () => {
  const { container } = mount(<KpiCard kpi={kpi({}, { achievement: 3.4 })} />);
  const fill = container.querySelector('.meter-arc');
  const track = fill?.parentElement?.querySelector('path');
  expect(screen.getByText('340%')).toBeTruthy();
  expect(fill?.getAttribute('d')).toBe(track?.getAttribute('d'));
});
it('KPIS-B07 a measure with no target reports that instead of leaving the answer blank', () => {
  const { container } = mount(
    <KpiCard
      kpi={kpi(
        {},
        {
          status: 'no_target',
          achievement: null,
          effectiveTarget: null,
          effectiveTargetPeriod: null,
        },
      )}
    />,
  );
  expect(screen.getAllByText(en.kpis.no_target).length).toBeGreaterThan(0);
  // An unset target is not a zero: the arc keeps its empty track and the figure is a dash.
  expect(container.querySelector('.meter-arc')).toBeNull();
  expect(screen.getByText('—')).toBeTruthy();
});
it('KPIS-B07 each status carries its own mark and word from the one status scale', () => {
  // A mark needs 3:1 and a word needs 4.5:1, so the word takes the ink variant of the same hue.
  const marks: [KpiStatus, string, string][] = [
    ['on_target', 'bg-status-good', 'text-status-good-ink'],
    ['near_target', 'bg-status-warn', 'text-status-warn-ink'],
    ['off_target', 'bg-status-bad', 'text-status-bad-ink'],
    ['no_data', 'bg-surface-raised', 'text-text-muted'],
    ['stale', 'bg-surface-raised', 'text-text-muted'],
    ['no_target', 'bg-surface-raised', 'text-text-muted'],
  ];
  for (const [status, mark, ink] of marks) {
    mount(<KpiCard kpi={kpi({}, { status })} />);
    // One chip carries both: its wash is the mark, its label the word, so the state is never
    // colour alone and never says itself twice.
    const chip = screen.getByText(en.kpis[status]);
    expect(chip.className).toContain(mark);
    expect(chip.className).toContain(ink);
  }
});
it('KPIS-B06 KPIS-A07 a row whose objective was deleted still names it, as archived', () => {
  mount(<KpiCard kpi={kpi({ objectiveDeleted: true })} />);
  expect(screen.getByText('Grow the base (archived)')).toBeTruthy();
});
it('KPIS-B07 a KPI with no reading says so instead of showing a number', () => {
  mount(
    <KpiCard
      kpi={kpi({}, { current: null, currentDate: null, percentChange: null, sparkline: [] })}
    />,
  );
  expect(screen.getByText(en.kpis.noReading)).toBeTruthy();
});
it('KPIS-B03 the gauge shows the achievement as its headline and names both figures it spans', () => {
  const { container } = mount(<KpiHeadline kpi={kpi({}, { achievement: 3.4 })} />);
  expect(screen.getByText('340%')).toBeTruthy();
  // The two figures the arc compares sit under its feet, each with what it belongs to.
  expect(screen.getByText(en.kpis.currentReading)).toBeTruthy();
  expect(screen.getByText('42.5 pts')).toBeTruthy();
  expect(screen.getByText(en.kpis.effectiveTarget)).toBeTruthy();
  expect(screen.getByText('50 pts')).toBeTruthy();
  // One arc for the track and one for the filled portion; the fill never runs past the track.
  expect(container.querySelectorAll('.recharts-radial-bar-sector').length).toBeGreaterThan(0);
  expect(screen.getByRole('img', { name: '340% of target · Near target' })).toBeTruthy();
});
it('KPIS-B03 KPIS-A03 without a usable ratio the gauge is dropped and the status stands alone', () => {
  const { container } = mount(
    <KpiHeadline
      kpi={kpi(
        {},
        {
          achievement: null,
          status: 'no_target',
          effectiveTarget: null,
          effectiveTargetPeriod: null,
        },
      )}
    />,
  );
  expect(container.querySelector('.recharts-radial-bar-sector')).toBeNull();
  expect(screen.getAllByText(en.kpis.no_target).length).toBeGreaterThan(0);
  expect(screen.getByText('42.5 pts')).toBeTruthy();
});
it('KPIS-B08 the period toggle moves the comparison and every figure the arc states', () => {
  mount(<KpiHeadline kpi={kpi()} />);
  const group = screen.getByRole('group', { name: en.kpis.measuredAgainst });
  const options = within(group).getAllByRole('button');
  expect(options.map((option) => option.textContent)).toEqual(['Q2 2026', 'Q3 2026', 'Q4 2026']);
  // It opens on the quarter the KPI is measured against, so the record agrees with the row.
  expect(options[1]?.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('85%')).toBeTruthy();
  expect(screen.getByText('50 pts')).toBeTruthy();
  fireEvent.click(options[2] as HTMLElement);
  expect(screen.getByText('71%')).toBeTruthy();
  expect(screen.getByText('60 pts')).toBeTruthy();
  expect(screen.getByText(en.kpis.off_target)).toBeTruthy();
  // The reading never moves: only what it is being read against does.
  expect(screen.getByText('42.5 pts')).toBeTruthy();
});
it('KPIS-B08 KPIS-A05 the year form offers the KPI cadence in order and pre-fills what is set', () => {
  mount(
    <KpiTargets
      kpi={kpi({
        targets: [
          { id: '01a08a9f-1991-760a-b73a-568f6f866511', year: 2026, period: 1, targetValue: 10 },
          { id: '01a08a9f-1991-760a-b73a-568f6f866512', year: 2026, period: 3, targetValue: 30 },
        ],
      })}
      editable={true}
    />,
  );
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((label) => screen.getByLabelText(label));
  expect(quarters.map((field) => (field as HTMLInputElement).value)).toEqual(['10', '', '30', '']);
  // Tab order is source order, so the form walks Q1 to Q4.
  const inputs = [...document.querySelectorAll('input')];
  expect(inputs.indexOf(quarters[0] as HTMLInputElement)).toBeLessThan(
    inputs.indexOf(quarters[3] as HTMLInputElement),
  );
  // The form is the display: it covers one year at a time, stepped from a single control, and
  // nothing repeats the same four numbers in a table underneath it.
  const years = screen.getByRole('group', { name: en.kpis.year });
  expect(within(years).getByText('2026')).toBeTruthy();
  fireEvent.click(within(years).getByRole('button', { name: en.kpis.nextYear }));
  expect(within(years).getByText('2027')).toBeTruthy();
  // Stepping to a year nobody has planned yet clears the form rather than carrying numbers over.
  expect(quarters.map((field) => (field as HTMLInputElement).value)).toEqual(['', '', '', '']);
  expect(screen.queryByRole('table')).toBeNull();
});
it('KPIS-B08 a deleted KPI shows its targets without offering to change them', () => {
  mount(
    <KpiTargets
      kpi={kpi({
        targets: [
          { id: '01a08a9f-1991-760a-b73a-568f6f866511', year: 2026, period: 1, targetValue: 10 },
        ],
      })}
      editable={false}
    />,
  );
  expect(screen.queryByLabelText('Q1')).toBeNull();
  const table = screen.getByRole('table');
  expect(within(table).getByRole('rowheader', { name: '2026' })).toBeTruthy();
  expect(within(table).getAllByText(en.kpis.unset)).toHaveLength(3);
});
it('KPIS-B08 the record answers in a sentence before it draws anything', () => {
  mount(<KpiSummary kpi={kpi()} />);
  const sentence = screen.getByText(/Net promoter|42.5|85/u).textContent ?? '';
  expect(sentence).toContain('42.5 pts');
  expect(sentence).toContain('50 pts');
  expect(sentence).toContain('Q3 2026');
  expect(sentence).toContain(en.kpis.near_target.toLocaleLowerCase());
});
it('KPIS-B04 the newest note that says anything is quoted under the headline', () => {
  const readings: Reading[] = [
    {
      id: '01a08a9f-1991-760a-b73a-568f6f866521',
      revision: 1,
      readingDate: '2026-09-09',
      value: 42.5,
      note: '',
      future: false,
      createdAt: '2026-09-09T07:00:00.000Z',
    },
    {
      id: '01a08a9f-1991-760a-b73a-568f6f866522',
      revision: 1,
      readingDate: '2026-08-09',
      value: 34,
      note: 'Two large accounts renewed early.',
      future: false,
      createdAt: '2026-08-09T07:00:00.000Z',
    },
  ];
  mount(<LatestNote kpi={kpi({ readings })} />);
  expect(screen.getByText('Two large accounts renewed early.')).toBeTruthy();
  // An empty note is not a note: the quote skips it and takes the newest one that says something.
  mount(<LatestNote kpi={kpi({ readings: [readings[0] as Reading] })} />);
  expect(screen.queryByText(en.kpis.latestNote)).toBeNull();
});
it('KPIS-B08 the trend starts at the first reading, not eight periods before it', () => {
  const readings: Reading[] = [
    {
      id: '01a08a9f-1991-760a-b73a-568f6f866521',
      revision: 1,
      readingDate: '2026-09-09',
      value: 42.5,
      note: '',
      future: false,
      createdAt: '2026-09-09T07:00:00.000Z',
    },
    {
      id: '01a08a9f-1991-760a-b73a-568f6f866522',
      revision: 1,
      readingDate: '2026-05-04',
      value: 34,
      note: '',
      future: false,
      createdAt: '2026-05-04T07:00:00.000Z',
    },
  ];
  mount(<KpiTrend kpi={kpi({ readings })} />);
  // A KPI first read in Q2 has no history before Q2: showing 2024 and 2025 as blank columns would
  // report a gap in a record that had not started.
  const table = screen.getByRole('table');
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(2);
  expect(rows[0]?.textContent).toContain('Q2 2026');
  expect(rows[1]?.textContent).toContain('Q3 2026');
});
it('KPIS-B08 a period that was planned but not reported still stands under its target', () => {
  const readings: Reading[] = [
    {
      id: '01a08a9f-1991-760a-b73a-568f6f866531',
      revision: 1,
      readingDate: '2026-09-09',
      value: 42.5,
      note: '',
      future: false,
      createdAt: '2026-09-09T07:00:00.000Z',
    },
  ];
  const targets: Target[] = [1, 2, 3, 4].map((period) => ({
    id: `01a08a9f-1991-760a-b73a-568f6f86654${period}`,
    year: 2026,
    period,
    targetValue: 40 + period,
  }));
  mount(<KpiTrend kpi={kpi({ readings, targets })} />);
  // The plan runs to the end of the year, so the quarters nobody has reported are columns with a
  // target and no reading — which is the gap the chart exists to show.
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  expect(rows.map((row) => row.textContent)).toEqual([
    'Q1 202641 pts',
    'Q2 202642 pts',
    'Q3 202642.5 pts43 pts',
    'Q4 202644 pts',
  ]);
});
it('KPIS-B08 a quarter is named in Arabic, not numbered', () => {
  mount(<KpiHeadline kpi={kpi()} />, 'ar');
  // "الربع الأول" is how a quarter is said; "الربع 1" is how it is written down by a program.
  const toggle = screen.getByRole('group', { name: ar.kpis.measuredAgainst });
  expect(
    within(toggle)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['الربع الثاني 2026', 'الربع الثالث 2026', 'الربع الرابع 2026']);
});
