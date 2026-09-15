// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { mount } from './harness';
const series: TrendPoint[] = [
  { key: '2026-2', label: 'Q2 2026', value: 10, target: 20 },
  { key: '2026-3', label: 'Q3 2026', value: 14, target: 20 },
  { key: '2026-4', label: 'Q4 2026', value: 18, target: 25 },
];
const labels = {
  period: 'Period',
  value: 'Reading',
  target: 'Target',
  caption: 'Readings for Uptime',
};
const format = { value: (value: number) => String(value) };
const chart = (rtl: boolean) => (
  <TrendChart
    series={series}
    labels={labels}
    format={format}
    tone="positive"
    rtl={rtl}
    width={640}
  />
);
// The columns' own geometry, which is where the direction of the time axis actually shows: the
// first reading stands at the edge the reader starts from.
const readingBars = (container: HTMLElement) =>
  [...container.querySelectorAll('.recharts-rectangle')].map((bar) =>
    Number(bar.getAttribute('x') ?? 0),
  );
it('KPIS-A08 the time axis runs from the edge the reader starts at', () => {
  const ltr = readingBars(mount(chart(false)).container);
  expect(ltr).toHaveLength(series.length);
  expect(ltr[0]).toBeLessThan(ltr.at(-1) ?? 0);
  const rtl = readingBars(mount(chart(true), 'ar').container);
  expect(rtl[0]).toBeGreaterThan(rtl.at(-1) ?? 0);
  // Mirrored, not redrawn: the series occupies the same span of the plot either way.
  const span = (values: number[]) => Math.abs((values.at(-1) ?? 0) - (values[0] ?? 0));
  expect(span(ltr)).toBeCloseTo(span(rtl), 1);
});
it('KPIS-A08 KPIS-B08 the plot keeps its structure in both directions: the marks carry the figures', () => {
  for (const rtl of [false, true]) {
    const { container } = mount(chart(rtl), rtl ? 'ar' : 'en');
    // Readings are the mass and the target is one line of dots over them, never a second scale.
    expect(container.querySelectorAll('.recharts-rectangle')).toHaveLength(series.length);
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(1);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(series.length);
    // Every mark states its own value, so there is no value axis and no grid to repeat them.
    expect(container.querySelector('.recharts-yAxis')).toBeNull();
    expect(container.querySelector('.recharts-cartesian-grid')).toBeNull();
    expect(container.querySelectorAll('.recharts-xAxis')).toHaveLength(1);
  }
});
it('KPIS-B08 the columns carry the KPI status colour so the record says one thing', () => {
  const { container } = mount(chart(false));
  const fills = [...container.querySelectorAll('.recharts-rectangle')].map((bar) =>
    bar.getAttribute('fill'),
  );
  expect(new Set(fills)).toEqual(new Set(['var(--status-good)']));
});
it('KPIS-B08 the chart ships the same figures as a table and names both series in its legend', () => {
  mount(chart(false));
  const table = screen.getByRole('table', { name: labels.caption });
  expect(within(table).getAllByRole('row')).toHaveLength(series.length + 1);
  expect(within(table).getByRole('columnheader', { name: labels.target })).toBeTruthy();
  expect(within(table).getByRole('cell', { name: '25' })).toBeTruthy();
  // The legend is the identity channel, so both series are named outside the plot as well.
  const legend = screen.getByRole('figure').querySelector('figcaption');
  expect(legend?.textContent).toContain(labels.value);
  expect(legend?.textContent).toContain(labels.target);
});
it('KPIS-B08 a KPI with no targets draws the readings alone, with no reference series', () => {
  const { container } = mount(
    <TrendChart
      series={series.map((point) => ({ ...point, target: null }))}
      labels={labels}
      format={format}
      width={640}
    />,
  );
  expect(container.querySelectorAll('.recharts-rectangle')).toHaveLength(series.length);
  expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(0);
  const table = screen.getByRole('table', { name: labels.caption });
  expect(within(table).queryByRole('columnheader', { name: labels.target })).toBeNull();
});
it('KPIS-B08 a period nobody reported keeps its place on the axis with no column over it', () => {
  const gap: TrendPoint[] = [
    { key: '2026-1', label: 'Q1 2026', value: 12, target: 20 },
    { key: '2026-2', label: 'Q2 2026', value: null, target: 20 },
    { key: '2026-3', label: 'Q3 2026', value: 14, target: 20 },
  ];
  const { container } = mount(
    <TrendChart series={gap} labels={labels} format={format} width={640} />,
  );
  // The missing quarter is the thing a scorecard most needs to show: no column, but the period is
  // still on the axis and still in the table, so the gap is visible rather than closed over.
  expect(container.querySelectorAll('.recharts-rectangle')).toHaveLength(2);
  const table = screen.getByRole('table', { name: labels.caption });
  expect(within(table).getAllByRole('row')).toHaveLength(gap.length + 1);
  expect(within(table).getByRole('cell', { name: 'Q2 2026' })).toBeTruthy();
});
