'use client';
import { useCount } from '@/ui/format';
import { useTaskCount } from './queries';
// TASKS-B17: how much is open, without opening the module. Zero is not worth a chip, and neither
// is a placeholder while the figure loads, so both render nothing.
export function TaskCountBadge() {
  const format = useCount();
  const open = useTaskCount();
  if (!open) return null;
  return (
    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs tabular-nums text-text-muted group-aria-[current=page]/nav:bg-accent-soft group-aria-[current=page]/nav:text-accent">
      {format(open)}
    </span>
  );
}
