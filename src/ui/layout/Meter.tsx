import { cn } from '@/ui/cn';
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
