'use client';
import type { ReactNode } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts';
import { chartColor, chartMark, toneColor, type ChartTone } from './tokens';
import { ChartTable } from './ChartTable';
// `label` is what the axis calls the point: the reading's own reporting period, named at the
// cadence the KPI is reported on.
export type TrendPoint = { date: string; label: string; value: number; target: number | null };
export type TrendLabels = { date: string; value: string; target: string; caption: string };
export type TrendFormat = { value: (value: number) => string; date: (date: string) => string };
// The card reserves the plot plus its axis band, so the labels never scroll inside their own box.
const HEIGHT = 240;
const axisTick = { fill: chartColor.reference, fontSize: 11 };
const axisLine = { stroke: chartColor.grid };
const cursor = { fill: chartColor.grid, fillOpacity: 0.25 };
const figure = { fill: chartColor.reference, fontSize: 11 };
const targetDot = { r: 4, fill: chartColor.reference, stroke: chartColor.surface, strokeWidth: 2 };
const margin = { top: 8, right: 12, bottom: 4, left: 4 };
// Recharts hands a label its raw value; only a number is ours to format, and a missing target has
// no label to draw at all.
type Renderable = string | number | boolean | null | undefined;
const asFigure = (format: TrendFormat) => (value: Renderable) =>
  typeof value === 'number' ? format.value(value) : '';
type PlotProps = {
  series: TrendPoint[];
  labels: TrendLabels;
  format: TrendFormat;
  tone: ChartTone;
  rtl: boolean;
  hasTarget: boolean;
  width: number | undefined;
};
// KPIS-B08: each reading is a column and the quarter's target runs across them as a line — the
// measurement is the mass, the target is the rule it is read against. Two marks of different kinds,
// so neither is mistaken for a second measure; the legend names both, written in HTML rather than
// drawn by the chart, because it is the identity channel that has to survive translation, the text
// tokens and a screen reader. The columns carry the KPI's status colour, so the record's figure,
// its arc and its history all say the same thing. The target is stepped and dashed, which is what a
// threshold looks like. The axis runs from the edge the reader starts at, so in RTL both the time
// axis and the value axis move to the other side.
export function TrendChart({
  series,
  labels,
  format,
  tone = 'neutral',
  rtl = false,
  width,
}: {
  series: TrendPoint[];
  labels: TrendLabels;
  format: TrendFormat;
  tone?: ChartTone;
  rtl?: boolean;
  width?: number;
}) {
  const hasTarget = series.some((point) => point.target !== null);
  const plot = (
    <Plot
      series={series}
      labels={labels}
      format={format}
      tone={tone}
      rtl={rtl}
      hasTarget={hasTarget}
      width={width}
    />
  );
  return (
    <figure className="m-0 grid gap-2">
      <Legend value={labels.value} target={hasTarget ? labels.target : null} tone={tone} />
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
// KPIS-B08: the target for each period, a dot over its own column with its value beside it. It is
// a reference the readings are read against, drawn as a line through a dot on each period's value.
// Its figure sits
// well above the dot: a target close to its reading would otherwise write over the column's own
// figure, and the plot leaves headroom above the tallest mark for exactly this.
function targetMark(name: string, format: TrendFormat) {
  return (
    <Line dataKey="target" name={name} strokeWidth={0} dot={targetDot} isAnimationActive={false}>
      <LabelList
        dataKey="target"
        position="top"
        offset={20}
        formatter={asFigure(format)}
        {...figure}
      />
    </Line>
  );
}
function Plot({ series, labels, format, tone, rtl, hasTarget, width }: PlotProps) {
  return (
    <ComposedChart
      data={series}
      width={width ?? 0}
      height={HEIGHT}
      margin={margin}
      accessibilityLayer
    >
      <XAxis
        dataKey="label"
        reversed={rtl}
        tickLine={false}
        axisLine={axisLine}
        tick={axisTick}
        minTickGap={24}
      />
      {/* Every mark carries its own figure, so a value scale down the side would only repeat them
          and a grid behind them would be ink with nothing to say. The axis stays in the data. */}
      <YAxis hide domain={[0, (max: number) => Math.ceil(max * 1.25)]} />
      <Tooltip
        cursor={cursor}
        content={(props: TooltipContentProps) => (
          <TrendTooltip {...props} labels={labels} format={format} />
        )}
      />
      <Bar
        dataKey="value"
        name={labels.value}
        fill={toneColor[tone]}
        maxBarSize={chartMark.bar}
        radius={[chartMark.cap, chartMark.cap, 0, 0]}
        isAnimationActive={false}
      >
        <LabelList
          dataKey="value"
          position="top"
          offset={8}
          formatter={asFigure(format)}
          {...figure}
        />
      </Bar>
      {hasTarget && targetMark(labels.target, format)}
    </ComposedChart>
  );
}
// A column swatch and a target dot, each beside its name in text tokens: identity comes from the
// mark next to the words, never from colouring the words.
function Legend({
  value,
  target,
  tone,
}: {
  value: string;
  target: string | null;
  tone: ChartTone;
}) {
  return (
    <figcaption className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
      <Key label={value}>
        <svg width={14} height={10} aria-hidden={true}>
          <rect x={0} y={0} width={14} height={10} rx={2} fill={toneColor[tone]} />
        </svg>
      </Key>
      {target && (
        <Key label={target}>
          <svg width={10} height={10} aria-hidden={true}>
            <circle cx={5} cy={5} r={4} fill={chartColor.reference} />
          </svg>
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
