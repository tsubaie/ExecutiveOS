import { chartColor } from './tokens';
// KPIS-B05: the shape of the last eight readings, sized to sit inside a list row.
//
// This is the one mark drawn directly rather than instantiated from the chart library. A list holds
// fifty of these; a charting runtime per row costs more than the whole rest of the page and would
// pull the library into the list route's own bundle, where it buys nothing — there are no axes, no
// tooltip and no legend at 64 by 24 pixels. The library stays for the record's trend and gauge,
// which are loaded with the panel that shows them.
//
// One series, so there is no legend and no direct label: the row prints the current value, the
// change and the target beside it, and this only says which way the line has been moving. It
// carries a spoken summary rather than a table twin — fifty hidden tables in one list would drown
// the rows they belong to, and every figure it draws is already in the row as text.
// SVG content does not follow the document direction, so it is mirrored in RTL to run from the
// edge the reader starts at, the way the row's own time reads.
export function Sparkline({
  points,
  label,
  width = 64,
  height = 24,
}: {
  points: { date: string; value: number }[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  // A flat series has no span to scale against; it is drawn along the middle rather than divided
  // by zero, which is the honest picture of a reading that has not moved.
  const span = Math.max(...values) - low || 1;
  const inset = 2;
  const step = (width - inset * 2) / (points.length - 1);
  const line = values
    .map(
      (value, index) =>
        `${inset + index * step},${inset + (height - inset * 2) * (1 - (value - low) / span)}`,
    )
    .join(' ');
  return (
    <span role="img" aria-label={label} className="inline-block shrink-0 rtl:-scale-x-100">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden={true}>
        <polyline
          points={line}
          fill="none"
          stroke={chartColor.reference}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
