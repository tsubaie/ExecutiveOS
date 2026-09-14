'use client';
import type { ReactNode } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts';
import { chartColor, chartMark } from './tokens';
import { ChartTable } from './ChartTable';
export type TrendPoint = { date: string; value: number; target: number | null };
export type TrendLabels = { date: string; value: string; target: string; caption: string };
export type TrendFormat = { value: (value: number) => string; date: (date: string) => string };
// The card reserves the plot plus its axis band, so the labels never scroll inside their own box.
const HEIGHT = 240;
const axisTick = { fill: chartColor.reference, fontSize: 11 };
const axisLine = { stroke: chartColor.grid };
const dot = {
  r: chartMark.dot,
  fill: chartColor.series,
  stroke: chartColor.surface,
  strokeWidth: chartMark.ring,
};
const activeDot = { r: chartMark.dot + 1, stroke: chartColor.surface, strokeWidth: chartMark.ring };
const cursor = { stroke: chartColor.grid, strokeWidth: chartMark.hairline };
const margin = { top: 8, right: 12, bottom: 4, left: 4 };
type PlotProps = {
  series: TrendPoint[];
  labels: TrendLabels;
  format: TrendFormat;
  rtl: boolean;
  hasTarget: boolean;
  width: number | undefined;
};
// KPIS-B08: readings against the quarter's target. Two series, so the legend is always present; it
// is written in HTML rather than drawn by the chart, because it is the identity channel that has to
// survive translation, the text tokens and a screen reader. The target is the reference, not a
// second measure: it steps between quarters and is dashed, which is what a threshold looks like.
// The axis runs from the edge the reader starts at, so in RTL the time axis is reversed.
export function TrendChart({
  series,
  labels,
  format,
  rtl = false,
  width,
}: {
  series: TrendPoint[];
  labels: TrendLabels;
  format: TrendFormat;
  rtl?: boolean;
  width?: number;
}) {
  const hasTarget = series.some((point) => point.target !== null);
  const plot = (
    <Plot
      series={series}
      labels={labels}
      format={format}
      rtl={rtl}
      hasTarget={hasTarget}
      width={width}
    />
  );
  return (
    <figure className="m-0 grid gap-2">
      <Legend value={labels.value} target={hasTarget ? labels.target : null} />
      <div className="h-60 w-full">
        {width ? (
          plot
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {plot}
          </ResponsiveContainer>
        )}
      </div>
      <ChartTable
        caption={labels.caption}
        columns={[labels.date, labels.value, ...(hasTarget ? [labels.target] : [])]}
        rows={series.map((point) => ({
          key: point.date,
          cells: [
            format.date(point.date),
            format.value(point.value),
            ...(hasTarget ? [point.target === null ? '' : format.value(point.target)] : []),
          ],
        }))}
      />
    </figure>
  );
}
function Plot({ series, labels, format, rtl, hasTarget, width }: PlotProps) {
  return (
    <LineChart data={series} width={width ?? 0} height={HEIGHT} margin={margin} accessibilityLayer>
      <CartesianGrid stroke={chartColor.grid} strokeWidth={chartMark.hairline} vertical={false} />
      <XAxis
        dataKey="date"
        reversed={rtl}
        tickFormatter={format.date}
        tickLine={false}
        axisLine={axisLine}
        tick={axisTick}
        minTickGap={24}
      />
      <YAxis
        orientation={rtl ? 'right' : 'left'}
        tickFormatter={format.value}
        tickLine={false}
        axisLine={false}
        tick={axisTick}
        width={48}
      />
      <Tooltip
        cursor={cursor}
        content={(props: TooltipContentProps) => (
          <TrendTooltip {...props} labels={labels} format={format} />
        )}
      />
      {hasTarget && (
        <Line
          type="stepAfter"
          dataKey="target"
          name={labels.target}
          stroke={chartColor.reference}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      )}
      <Line
        type="monotone"
        dataKey="value"
        name={labels.value}
        stroke={chartColor.series}
        strokeWidth={chartMark.line}
        strokeLinecap="round"
        strokeLinejoin="round"
        dot={dot}
        activeDot={activeDot}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
// Two line keys and their names, in text tokens: identity comes from the mark beside the word.
function Legend({ value, target }: { value: string; target: string | null }) {
  return (
    <figcaption className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
      <Key label={value}>
        <span className="h-0.5 w-4 rounded-full bg-accent" />
      </Key>
      {target && (
        <Key label={target}>
          <span className="h-0 w-4 border-t-2 border-dashed border-text-muted" />
        </Key>
      )}
    </figcaption>
  );
}
function Key({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden={true} className="inline-flex w-4 items-center">
        {children}
      </span>
      {label}
    </span>
  );
}
function TrendTooltip({
  active,
  label,
  payload,
  labels,
  format,
}: TooltipContentProps & { labels: TrendLabels; format: TrendFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{typeof label === 'string' ? format.date(label) : ''}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="mt-1 flex items-center gap-2 text-text-muted">
          <span>{entry.dataKey === 'target' ? labels.target : labels.value}</span>
          <span className="tabular-nums text-text">
            {typeof entry.value === 'number' ? format.value(entry.value) : ''}
          </span>
        </p>
      ))}
    </div>
  );
}
