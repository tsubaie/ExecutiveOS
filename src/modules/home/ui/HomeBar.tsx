import { Check } from 'lucide-react';
import { Meter } from '@/ui/layout/Meter';
export { Meter };
const ROUND = 1.5;
// HOME-B09: work that has slipped. No tick: a tick reads as something achieved, and nothing here
// has been. The meter is red and the count states it plainly.
export function Late({ late, open }: { late: number; open: number }) {
  if (late <= 0) return null;
  return <Meter filled={late} total={open} tone="danger" />;
}
// HOME-B09: how far a committee has got, in the compact form the row's other facts already use.
export function Progress({ done, open }: { done: number; open: number }) {
  const total = done + open;
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <Check className="size-3 shrink-0 text-accent" aria-hidden />
      <Meter filled={done} total={total} tone="accent" />
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
      {late > 0 && (
        <rect x={0} y={0} width={late} height={3} rx={ROUND} className="meter-fill fill-danger" />
      )}
    </svg>
  );
}
