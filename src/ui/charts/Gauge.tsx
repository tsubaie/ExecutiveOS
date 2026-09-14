'use client';
import type { ReactNode } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { chartColor, toneColor, type ChartTone } from './tokens';
// KPIS-B03: one ratio against one limit, so the mark is a meter bent into an arc rather than a dial
// with a needle: no ticks to misread, no second scale, and the figure itself is the hero. The arc
// stops at 100 percent because the question it answers is "are we there"; how far past is said in
// the figure, which runs to 999. Status is never colour alone — the badge names it in words.
const SIZE = { width: 208, height: 116, inner: 70, outer: 96, centre: 104 };
// `start` and `end` sit under the two feet of the arc: the reading the measure stands at, and what
// it is being read against. The arc spans between them, so the comparison is the shape of the mark
// rather than a caption under it.
// The arc itself: a meter bent through 180 degrees, capped at the limit it measures against. SVG
// content does not follow the document direction, so it is mirrored in RTL to fill from the edge
// the reader starts at.
function Arc({ filled, tone, label }: { filled: number; tone: ChartTone; label: string }) {
  return (
    <span role="img" aria-label={label} className="block rtl:-scale-x-100">
      <RadialBarChart
        width={SIZE.width}
        height={SIZE.height}
        cy={SIZE.centre}
        innerRadius={SIZE.inner}
        outerRadius={SIZE.outer}
        startAngle={180}
        endAngle={0}
        data={[{ value: filled }]}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar
          dataKey="value"
          cornerRadius={4}
          fill={toneColor[tone]}
          background={{ fill: chartColor.grid }}
          isAnimationActive={false}
        />
      </RadialBarChart>
    </span>
  );
}
export function Gauge({
  achievement,
  tone,
  label,
  start,
  end,
  children,
}: {
  achievement: number | null;
  tone: ChartTone;
  label: string;
  start?: ReactNode;
  end?: ReactNode;
  children: ReactNode;
}) {
  const filled = achievement === null ? 0 : Math.min(Math.max(achievement, 0), 1) * 100;
  return (
    <div className="grid justify-items-center gap-1.5">
      <div className="relative grid justify-items-center">
        {achievement !== null && <Arc filled={filled} tone={tone} label={label} />}
        <div
          className={
            achievement === null
              ? 'grid justify-items-center gap-2 py-6'
              : 'absolute inset-x-0 bottom-1 grid justify-items-center gap-1'
          }
        >
          {children}
        </div>
      </div>
      {(start || end) && (
        <div className="flex w-52 items-start justify-between gap-3 text-xs">
          <span className="min-w-0 text-start">{start}</span>
          <span className="min-w-0 text-end">{end}</span>
        </div>
      )}
    </div>
  );
}
