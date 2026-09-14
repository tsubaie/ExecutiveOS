// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import {
  KpiDetail,
  type KpiMeta,
  type KpiStatus,
  type Reading,
  type Target,
} from '../../schema/validation';
import { KpiRow, KpiTrail } from '../../ui/KpiRow';
import { KpiHeadline } from '../../ui/KpiHeadline';
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
it('KPIS-B07 a row states its status in words and pairs every figure with its unit', () => {
  mount(
    <>
      <KpiRow kpi={kpi()} />
      <KpiTrail kpi={kpi()} />
    </>,
  );
  expect(screen.getByText(en.kpis.near_target)).toBeTruthy();
  expect(screen.getByText('Net promoter score')).toBeTruthy();
  expect(screen.getByText('Service · Grow the base')).toBeTruthy();
  expect(screen.getByText('42.5 pts')).toBeTruthy();
  expect(screen.getByText('Target 50 pts · Q3 2026')).toBeTruthy();
  expect(screen.getByText('+25%')).toBeTruthy();
  expect(screen.getByRole('img', { name: /Recent readings/u })).toBeTruthy();
});
it('KPIS-B07 each status carries its own mark and word from the one status scale', () => {
  // A mark needs 3:1 and a word needs 4.5:1, so the word takes the ink variant of the same hue.
  const marks: [KpiStatus, string, string][] = [
    ['on_target', 'bg-status-good', 'text-status-good-ink'],
    ['near_target', 'bg-status-warn', 'text-status-warn-ink'],
    ['off_target', 'bg-status-bad', 'text-status-bad-ink'],
    ['no_data', 'bg-text-muted', 'text-text-muted'],
    ['stale', 'bg-text-muted', 'text-text-muted'],
    ['no_target', 'bg-text-muted', 'text-text-muted'],
  ];
  for (const [status, mark, ink] of marks) {
    const { container } = mount(<KpiRow kpi={kpi({}, { status })} />);
    expect(container.querySelector('span[aria-hidden]')?.className).toContain(mark);
    // The state is never colour alone: the word is there, in the same hue.
    expect(screen.getByText(en.kpis[status]).className).toContain(ink);
  }
});
it('KPIS-B06 KPIS-A07 a row whose objective was deleted still names it, as archived', () => {
  mount(<KpiRow kpi={kpi({ objectiveDeleted: true })} />);
  expect(screen.getByText('Service · Grow the base (archived)')).toBeTruthy();
});
it('KPIS-B07 a KPI with no reading says so instead of showing a number', () => {
  mount(
    <KpiTrail
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
  const table = screen.getByRole('table');
  expect(within(table).getByRole('rowheader', { name: '2026' })).toBeTruthy();
  expect(within(table).getAllByText(en.kpis.unset)).toHaveLength(2);
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
  expect(screen.getByRole('table')).toBeTruthy();
});
