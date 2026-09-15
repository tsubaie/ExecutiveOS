import { cn } from '@/ui/cn';
import type { ChartTone } from '@/ui/charts/tokens';
// A comparison mark: one accent fill over a neutral track. Two rules shape these:
//
// Colour: a single accent fill over a neutral track. The pairing separates cleanly in both themes
// (OKLab dE 39.9 light, 46.8 dark). Two-tone alternatives were measured and rejected: accent against
// danger is indistinguishable under protanopia in the light theme (dE 5.6, under the 6 floor),
// warning against danger fails even for normal vision (dE 12.9, under 15), and a mid-grey against
// danger fails in the dark theme (dE 5.9 deutan, 13.5 normal). The track sits under 3:1 against the
// surface, so every meter ships with its figures in text beside it and is hidden from assistive
// technology: the numbers carry the information and the mark only paces it.
//
// Geometry: no inline styles are allowed in this codebase, so lengths are SVG attributes. The meter
// is a fixed small width that sits inline with the row's facts rather than a wide bar on its own
// line, so a column of them reads as one instrument. SVG content does not follow the document
// direction, so it is mirrored in RTL to fill from the edge the reader starts at.
const ROUND = 1.5;
export function Meter({
  filled,
  total,
  tone,
  className,
}: {
  filled: number;
  total: number;
  tone: 'accent' | 'danger';
  className?: string;
}) {
  const part = total > 0 ? (Math.min(filled, total) / total) * 100 : 0;
  return (
    <svg
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('h-[3px] w-6 shrink-0 rtl:-scale-x-100', className)}
    >
      <rect x={0} y={0} width={100} height={3} rx={ROUND} className="fill-border" />
      {part > 0 && (
        <rect
          x={0}
          y={0}
          width={part}
          height={3}
          rx={ROUND}
          className={`meter-fill ${tone === 'danger' ? 'fill-danger' : 'fill-accent'}`}
        />
      )}
    </svg>
  );
}

// The same meter bent into an arc, for the one place a proportion is the subject rather than a
// fact beside others: a scorecard tile, where a column of arcs reads as an instrument panel and
// the eye finds the short ones without reading a single figure (KPIS-B07).
//
// Drawn here rather than instantiated from the chart library for the reason the sparkline is
// (docs/05): a list holds fifty of these, and a charting runtime per tile costs more than the rest
// of the page while buying nothing at this size — no axis, no tooltip, no legend. The record's own
// gauge keeps the library, because it is loaded with the panel that shows it.
//
// It does not mirror in RTL. A linear meter fills from the edge its reader starts at, which is why
// `Meter` flips; a gauge fills clockwise in every language, and mirroring one only makes it read
// as running backwards.
const ARC = { sweep: 240, radius: 38, width: 9, centre: 50 };
function arcPath(portion: number) {
  const start = 90 + (360 - ARC.sweep) / 2;
  const end = start + ARC.sweep * portion;
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return [
      ARC.centre + ARC.radius * Math.cos(radians),
      ARC.centre + ARC.radius * Math.sin(radians),
    ].map((value) => value.toFixed(2));
  };
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const large = ARC.sweep * portion > 180 ? 1 : 0;
  return `M${x1},${y1} A${ARC.radius},${ARC.radius} 0 ${large} 1 ${x2},${y2}`;
}
const arcFills: Record<ChartTone, string> = {
  positive: 'stroke-status-good',
  caution: 'stroke-status-warn',
  negative: 'stroke-status-bad',
  neutral: 'stroke-text-muted',
};
export function MeterArc({
  ratio,
  tone,
  className,
}: {
  // The proportion of the limit reached; past it the arc stays full, the way the record's does.
  ratio: number | null;
  tone: ChartTone;
  className?: string;
}) {
  const portion = ratio === null ? 0 : Math.min(Math.max(ratio, 0), 1);
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn('size-full', className)}>
      <path
        d={arcPath(1)}
        fill="none"
        strokeWidth={ARC.width}
        strokeLinecap="round"
        className="stroke-border"
      />
      {portion > 0 && (
        <path
          d={arcPath(portion)}
          fill="none"
          pathLength={1}
          strokeWidth={ARC.width}
          strokeLinecap="round"
          className={cn('meter-arc', arcFills[tone])}
        />
      )}
    </svg>
  );
}
