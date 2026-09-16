'use client';
import { Fragment } from 'react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import { useCount } from '@/ui/format';
import type { Entity, View } from './types';
import type { Surface } from './surface';
const toneInk: Record<string, string> = {
  danger: 'text-danger',
  accent: 'text-accent',
  good: 'text-status-good-ink',
  warn: 'text-status-warn-ink',
  bad: 'text-status-bad-ink',
};
export function EntityViews<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const count = useCount();
  return (
    <div className="grid gap-0.5">
      {config.filters.views.map((view) => {
        const active = c.state.view === view.id;
        const Icon = view.icon;
        return (
          <Fragment key={view.id}>
            {view.separated && <hr className="my-1.5 border-border" />}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={active}
              className={cn(
                'h-8 w-full justify-start gap-2.5 px-2.5 font-normal text-text-muted',
                active && 'bg-accent-soft font-medium text-text',
              )}
              onClick={() => {
                c.navigate({ view: view.id }, true);
                c.setFiltersOpen(false);
              }}
            >
              {Icon && (
                <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'opacity-70')} />
              )}
              <span className="min-w-0 flex-1 truncate text-start">{view.label}</span>
              <span
                key={c.list.counts[view.id] ?? 0}
                className={cn(
                  'count-tick text-xs tabular-nums',
                  active ? 'text-accent' : 'text-text-muted',
                )}
              >
                {count(c.list.counts[view.id] ?? 0)}
              </span>
            </Button>
          </Fragment>
        );
      })}
    </div>
  );
}
// Featured views show their counts as a strip above the list; each is a shortcut to that view.
// EP-B35: not where the rail is already showing them. The rail lists every view with its count and
// the strip re-draws five of them bigger, forty pixels below — the same facts twice, costing 85 px
// of a desktop list and 198 px of a phone's. The strip is what a surface without a rail gets
// instead of one, so it appears exactly where the rail is not.
// EP-B40: a strip, not a block. Two columns turned five readings into three rows and an orphan
// with a hole beside it — 198 px of a 732 px phone list, before a single record. Narrow, the
// readings are one scrolling line and the strip costs a row; from @lg there is width for the grid
// and the tiles stand up again. `scroll-px-3` matches the padding: a snap position is measured from
// the scrollport edge, so without it the leading tile rests cut off by exactly the padding that was
// supposed to inset it.
export function EntityStats<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const featured = config.filters.views
    .filter((view) => view.featured === true)
    .sort((a, b) => (a.featuredOrder ?? 1) - (b.featuredOrder ?? 1));
  if (!featured.length) return null;
  return (
    <div
      data-entity-stats
      className={cn(
        // The display stays on the base layer. `xl:hidden` above is a variant, and a second
        // display utility behind a container query would out-order it, which is how the strip
        // came back on a desktop that was already showing every reading in the rail (EP-B35).
        // Narrow is therefore one grid row of content-sized tracks, not a flex line.
        'grid snap-x scroll-px-3 grid-flow-col auto-cols-max gap-2 overflow-x-auto border-b px-3 py-2',
        '@lg:grid-flow-row @lg:auto-cols-auto @lg:snap-none @lg:overflow-x-visible @lg:py-3',
        featured.length === 5 ? '@lg:grid-cols-5' : '@lg:grid-cols-4',
        c.railOpen && 'xl:hidden',
      )}
    >
      {featured.map((view) => (
        <FeaturedReading
          key={view.id}
          view={view}
          active={c.state.view === view.id}
          value={c.list.summaryCounts?.[view.id] ?? c.list.counts[view.id] ?? 0}
          open={() => c.navigate({ view: view.id }, true)}
        />
      ))}
    </div>
  );
}
// One reading: its name and its figure, on a line while the strip scrolls and stacked once the
// strip is a grid.
function FeaturedReading({
  view,
  active,
  value,
  open,
}: {
  view: View;
  active: boolean;
  value: number;
  open: () => void;
}) {
  const count = useCount();
  const Icon = view.icon;
  return (
    <Button
      variant="ghost"
      aria-pressed={active}
      className={cn(
        'h-auto min-w-0 shrink-0 snap-start flex-row items-center gap-2 px-2.5 py-1.5',
        '@lg:shrink @lg:flex-col @lg:items-start @lg:gap-1 @lg:px-3 @lg:py-2',
        'rounded-xl border text-start',
        active
          ? 'border-accent/50 bg-accent-soft hover:bg-accent-soft'
          : 'border-border bg-bg/60 hover:bg-surface-raised',
      )}
      onClick={open}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold tracking-wider text-text-muted uppercase @lg:w-full">
        {Icon && <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />}
        <span className="truncate">{view.label}</span>
      </span>
      <span
        key={value}
        className={cn(
          'count-tick text-base leading-none font-semibold tabular-nums @lg:text-2xl',
          value === 0 && 'text-text-muted',
          value > 0 && view.tone && toneInk[view.tone],
        )}
      >
        {count(value)}
      </span>
    </Button>
  );
}
