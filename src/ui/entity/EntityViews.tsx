'use client';
import { Fragment } from 'react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import { useCount } from '@/ui/format';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
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
                className={cn('text-xs tabular-nums', active ? 'text-accent' : 'text-text-muted')}
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
export function EntityStats<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const count = useCount();
  const featured = config.filters.views.filter((view) => view.featured);
  if (!featured.length) return null;
  return (
    <div className="grid grid-cols-4 gap-1 border-b px-2 py-1.5 @lg:px-3 @lg:py-2">
      {featured.map((view) => {
        const value = c.list.counts[view.id] ?? 0;
        const active = c.state.view === view.id;
        return (
          <Button
            key={view.id}
            variant="ghost"
            aria-pressed={active}
            className={cn(
              'h-auto min-w-0 flex-col items-start gap-0 px-2 py-1 @lg:px-2.5 @lg:py-1.5',
              active && 'bg-surface-raised',
            )}
            onClick={() => c.navigate({ view: view.id }, true)}
          >
            <span
              className={cn(
                'text-xl leading-none font-semibold tabular-nums @lg:text-2xl',
                value === 0 && 'text-text-muted',
                value > 0 && view.tone === 'danger' && 'text-danger',
                value > 0 && view.tone === 'accent' && 'text-accent',
              )}
            >
              {count(value)}
            </span>
            <span className="mt-1 w-full truncate text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              {view.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
