// Comparison marks for the home page. Two rules shape these:
//
// Colour: the validated pairing is a neutral mass with a danger portion. Accent against danger fails
// protanopia in the light theme (OKLab dE 5.6, under the 6 floor) and warning against danger fails
// even for normal vision (dE 12.9, under 15), so neither may carry meaning here. Neutral against
// danger separates cleanly in both themes (dE 36.5 light, 29.6 dark). The neutral itself sits under
// 3:1 against the surface, so every mark ships with its numbers in text beside it and is hidden from
// assistive technology: the figures, not the fill, carry the information.
//
// Geometry: no inline styles are allowed in this codebase, so the marks are SVG and the lengths are
// attributes. Bars are thin, end-rounded, anchored to the same baseline, and leave a gap between
// segments so two fills never touch.
const GAP = 1.5;
const ROUND = 1.5;
// SVG content does not follow the document direction, so the mark is mirrored in RTL to keep it
// growing from the edge the reader starts at.
function Segments({ safe, late }: { safe: number; late: number }) {
  return (
    <svg
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      aria-hidden
      className="h-[3px] w-full overflow-visible rtl:-scale-x-100"
    >
      {safe > 0 && <rect x={0} y={0} width={safe} height={3} rx={ROUND} className="fill-border" />}
      {late > 0 && (
        <rect
          x={safe > 0 ? safe + GAP : 0}
          y={0}
          width={late}
          height={3}
          rx={ROUND}
          className="fill-danger"
        />
      )}
    </svg>
  );
}
// HOME-B09: every committee's mark is the same width so the column reads as one instrument instead
// of a ragged set of stubs. Volume is already in the text beside it ("3 open"), so the mark is free
// to carry the thing the text cannot show at a glance: how much of that committee's work has slipped.
export function LoadBar({ open, overdue }: { open: number; overdue: number }) {
  const late = (Math.min(overdue, open) / Math.max(open, 1)) * 100;
  const safe = Math.max(100 - late - (late > 0 ? GAP : 0), 0);
  return <Segments safe={safe} late={late} />;
}
// HOME-B09: the shape of the overdue pile. A total says how much is late; the danger portion says
// how much has been late for a month or more, which is the difference between a backlog and a mess.
export function AgeingBar({ count, stale }: { count: number; stale: number }) {
  const scale = 100 / Math.max(count, 1);
  const late = Math.min(stale, count) * scale;
  const safe = Math.max(100 - late - (late > 0 ? GAP : 0), 0);
  return <Segments safe={safe} late={late} />;
}
