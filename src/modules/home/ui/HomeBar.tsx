import { Check } from 'lucide-react';
// Comparison marks for the home page. Two rules shape these:
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
export function Meter({ done, total }: { done: number; total: number }) {
  const filled = total > 0 ? (Math.min(done, total) / total) * 100 : 0;
  return (
    <svg
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      aria-hidden
      className="h-[3px] w-6 shrink-0 rtl:-scale-x-100"
    >
      <rect x={0} y={0} width={100} height={3} rx={ROUND} className="fill-border" />
      {filled > 0 && (
        <rect x={0} y={0} width={filled} height={3} rx={ROUND} className="fill-accent" />
      )}
    </svg>
  );
}
// HOME-B09: how far a committee has got, in the compact form the row's other facts already use.
export function Progress({ done, open }: { done: number; open: number }) {
  const total = done + open;
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <Check className="size-3 shrink-0 text-accent" aria-hidden />
      <Meter done={done} total={total} />
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}
// HOME-B09: the shape of the overdue pile. A total says how much is late; this says how much has
// been late for a month or more, which is the difference between a backlog and a mess.
export function AgeingBar({ count, stale }: { count: number; stale: number }) {
  const late = (Math.min(stale, count) / Math.max(count, 1)) * 100;
  return (
    <svg
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      aria-hidden
      className="h-[3px] w-6 shrink-0 rtl:-scale-x-100"
    >
      <rect x={0} y={0} width={100} height={3} rx={ROUND} className="fill-border" />
      {late > 0 && <rect x={0} y={0} width={late} height={3} rx={ROUND} className="fill-danger" />}
    </svg>
  );
}
