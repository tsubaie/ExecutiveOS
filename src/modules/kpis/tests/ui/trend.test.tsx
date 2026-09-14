// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { mount } from './harness';
const series: TrendPoint[] = [
  { date: '2026-07-01', value: 10, target: 20 },
  { date: '2026-08-01', value: 14, target: 20 },
  { date: '2026-09-01', value: 18, target: 25 },
];
const labels = { date: 'Date', value: 'Reading', target: 'Target', caption: 'Readings for Uptime' };
const format = { value: (value: number) => String(value), date: (date: string) => date.slice(5) };
const chart = (rtl: boolean) => (
  <TrendChart series={series} labels={labels} format={format} rtl={rtl} width={640} />
);
// The reading line's own geometry, which is where the direction of the time axis actually shows:
// the first point sits at the edge the reader starts from.
function readingLine(container: HTMLElement) {
  const curves = [...container.querySelectorAll('.recharts-line-curve')];
  const path = curves.at(-1)?.getAttribute('d') ?? '';
  const points = [...path.matchAll(/[ML,]?(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/gu)].map((match) =>
    Number(match[1]),
  );
  return { first: points[0] ?? 0, last: points.at(-1) ?? 0 };
}
it('KPIS-A08 the time axis runs from the edge the reader starts at', () => {
  const ltr = readingLine(mount(chart(false)).container);
  expect(ltr.first).toBeLessThan(ltr.last);
  const rtl = readingLine(mount(chart(true), 'ar').container);
  expect(rtl.first).toBeGreaterThan(rtl.last);
  // Mirrored, not redrawn: the series occupies the same span of the plot either way.
  expect(Math.abs(ltr.last - ltr.first)).toBeCloseTo(Math.abs(rtl.first - rtl.last), 1);
});
it('KPIS-A08 KPIS-B08 the plot keeps its structure in both directions: two series and one value axis', () => {
  for (const rtl of [false, true]) {
    const { container } = mount(chart(rtl), rtl ? 'ar' : 'en');
    // One reading line and one stepped target reference, never a second value scale.
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2);
    expect(container.querySelectorAll('.recharts-yAxis')).toHaveLength(1);
    expect(container.querySelectorAll('.recharts-xAxis')).toHaveLength(1);
    expect(container.querySelectorAll('.recharts-line-dot').length).toBe(series.length);
  }
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
  expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(1);
  const table = screen.getByRole('table', { name: labels.caption });
  expect(within(table).queryByRole('columnheader', { name: labels.target })).toBeNull();
});
