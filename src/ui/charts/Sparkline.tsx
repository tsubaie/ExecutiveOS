'use client';
import { useId } from 'react';
import { toneColor, type ChartTone } from './tokens';
// KPIS-B05: the shape of the last eight readings, sized to sit inside a list row, carrying the
// KPI's own status colour and a wash under the line that fades out before the row's edge.
//
// This is the one mark drawn directly rather than instantiated from the chart library. A list holds
// fifty of these; a charting runtime per row costs more than the whole rest of the page and would
// pull the library into the list route's own bundle, where it buys nothing — there are no axes, no
// tooltip and no legend at this size. The library stays for the record's trend and gauge, which are
// loaded with the panel that shows them.
//
// One series, so there is no legend and no direct label: the row prints the current value, the
// change and the target beside it, and this only says which way the line has been moving. It
// carries a spoken summary rather than a table twin — fifty hidden tables in one list would drown
// the rows they belong to, and every figure it draws is already in the row as text.
// SVG content does not follow the document direction, so it is mirrored in RTL to run from the
// edge the reader starts at, the way the row's own time reads.
const SIZE = { width: 96, height: 32, inset: 3 };
type Point = { x: number; y: number };
// A Catmull-Rom spline written as cubics: the curve passes through every reading rather than
// smoothing them away, which matters when the mark is standing in for the numbers.
function curve(points: Point[]) {
  const at = (index: number) => points[Math.min(Math.max(index, 0), points.length - 1)];
  const first = at(0);
  if (!first) return '';
  let path = `M${first.x},${first.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const after = at(index + 2);
    if (!before || !start || !end || !after) continue;
    path +=
      ` C${start.x + (end.x - before.x) / 6},${start.y + (end.y - before.y) / 6}` +
      ` ${end.x - (after.x - start.x) / 6},${end.y - (after.y - start.y) / 6}` +
      ` ${end.x},${end.y}`;
  }
  return path;
}
function geometry(values: number[]) {
  const low = Math.min(...values);
  // A flat series has no span to scale against; it is drawn along the middle rather than divided
  // by zero, which is the honest picture of a reading that has not moved.
  const span = Math.max(...values) - low || 1;
  const step = SIZE.width / (values.length - 1);
  const points = values.map((value, index) => ({
    x: index * step,
    y: SIZE.inset + (SIZE.height - SIZE.inset * 2) * (1 - (value - low) / span),
  }));
  const line = curve(points);
  return { line, area: `${line} L${SIZE.width},${SIZE.height} L0,${SIZE.height} Z` };
}
export function Sparkline({
  points,
  label,
  tone = 'neutral',
}: {
  points: { date: string; value: number }[];
  label: string;
  tone?: ChartTone;
}) {
  const gradient = useId();
  if (points.length < 2) return null;
  const { line, area } = geometry(points.map((point) => point.value));
  const colour = toneColor[tone];
  return (
    <span role="img" aria-label={label} className="inline-block shrink-0 rtl:-scale-x-100">
      <svg
        width={SIZE.width}
        height={SIZE.height}
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        aria-hidden={true}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradient})`} />
        <path
          d={line}
          fill="none"
          stroke={colour}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
