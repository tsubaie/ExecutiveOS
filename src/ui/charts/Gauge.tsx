'use client';
import type { ReactNode } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { chartColor } from './tokens';
// KPIS-B03: one ratio against one limit, so the mark is a meter bent into an arc rather than a dial
// with a needle: no ticks to misread, no second scale, and the figure itself is the hero. The arc
// stops at 100 percent because the question it answers is "are we there"; how far past is said in
// the figure, which runs to 999. Status is never colour alone — the badge names it in words.
const SIZE = { width: 208, height: 116, inner: 70, outer: 96, centre: 104 };
// A tone, not a status: the wrapper stays a chart and the module keeps the vocabulary.
export type GaugeTone = 'positive' | 'caution' | 'negative' | 'neutral';
const fills: Record<GaugeTone, string> = {
  positive: chartColor.on_target,
  caution: chartColor.near_target,
  negative: chartColor.off_target,
  neutral: chartColor.neutral,
};
export function Gauge({
  achievement,
  tone,
  label,
  children,
}: {
  achievement: number | null;
  tone: GaugeTone;
  label: string;
  children: ReactNode;
}) {
  const filled = achievement === null ? 0 : Math.min(Math.max(achievement, 0), 1) * 100;
  return (
    <div className="relative grid justify-items-center">
      {achievement !== null && (
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
              fill={fills[tone]}
              background={{ fill: chartColor.grid }}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </span>
      )}
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
  );
}
