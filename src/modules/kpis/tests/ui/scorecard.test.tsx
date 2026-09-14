// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import { KpiDetail, type KpiMeta, type Reading, type Target } from '../../schema/validation';
import { KpiRow, KpiTrail } from '../../ui/KpiRow';
import { KpiHeadline } from '../../ui/KpiHeadline';
import { KpiTargets } from '../../ui/KpiTargets';
import { mount } from './harness';
const base = {
  id: '01a08a9f-1991-760a-b73a-568f6f866500',
  revision: 2,
  name: 'Net promoter score',
  unit: 'pts',
  direction: 'higher',
  category: 'Service',
  objectiveId: null,
  objectiveName: 'Grow the base',
  objectiveDeleted: false,
  teams: [],
  notes: '',
  freshnessDays: 120,
  sortOrder: 0,
  createdAt: '2026-09-01T07:00:00.000Z',
  updatedAt: '2026-09-01T07:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedOpId: null,
  readings: [] as Reading[],
  targets: [] as Target[],
  previousQuarter: null,
};
const meta: KpiMeta = {
  current: 42.5,
  currentDate: '2026-09-09',
  previous: 34,
  percentChange: 0.25,
  effectiveTarget: 50,
  effectiveTargetLabel: '2026-Q3',
  status: 'near_target',
  achievement: 0.85,
  sparkline: [
    { date: '2026-08-09', value: 34 },
    { date: '2026-09-09', value: 42.5 },
  ],
};
const kpi = (overrides: Partial<typeof base> = {}, metaOverrides: Partial<KpiMeta> = {}) =>
  KpiDetail.parse({ ...base, ...overrides, meta: { ...meta, ...metaOverrides } });
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
it('KPIS-B03 the gauge shows the achievement as its headline and caps the arc at the target', () => {
  const { container } = mount(<KpiHeadline kpi={kpi({}, { achievement: 3.4 })} />);
  expect(screen.getByText('340%')).toBeTruthy();
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
          effectiveTargetLabel: null,
        },
      )}
    />,
  );
  expect(container.querySelector('.recharts-radial-bar-sector')).toBeNull();
  expect(screen.getAllByText(en.kpis.no_target).length).toBeGreaterThan(0);
  expect(screen.getByText('42.5 pts')).toBeTruthy();
});
it('KPIS-B08 KPIS-A05 the year form offers the four quarters in order and pre-fills what is set', () => {
  mount(
    <KpiTargets
      kpi={kpi({
        targets: [
          { id: '01a08a9f-1991-760a-b73a-568f6f866511', year: 2026, quarter: 1, targetValue: 10 },
          { id: '01a08a9f-1991-760a-b73a-568f6f866512', year: 2026, quarter: 3, targetValue: 30 },
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
          { id: '01a08a9f-1991-760a-b73a-568f6f866511', year: 2026, quarter: 1, targetValue: 10 },
        ],
      })}
      editable={false}
    />,
  );
  expect(screen.queryByLabelText('Q1')).toBeNull();
  expect(screen.getByRole('table')).toBeTruthy();
});
