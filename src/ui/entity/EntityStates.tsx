'use client';
import { useTranslations } from 'next-intl';
import { Inbox } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
// What the list shows when it has no rows to show: the shape of the rows while the first page
// loads, and the two empty states — nothing here at all, versus nothing matching (EP-B15).
// Placeholder rows at the real row height keep the layout stable while the first page loads.
export function EntityListSkeleton() {
  const t = useTranslations('common');
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'];
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">{t('loading')}</span>
      {rows.map((row, index) => (
        <div key={row} aria-hidden className="flex h-11 items-center gap-3 border-b px-4">
          <span className="size-4 rounded-full bg-surface-raised" />
          <span
            className={cn(
              'h-3 rounded bg-surface-raised',
              index % 3 === 0 ? 'w-2/3' : index % 3 === 1 ? 'w-1/2' : 'w-3/5',
            )}
          />
          <span className="ms-auto h-3 w-12 rounded bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}
function isFiltered<T extends Entity, P extends object, C>(c: Surface<T, P, C>['controller']) {
  return Boolean(
    c.state.q || c.state.sort || c.state.view !== 'all' || Object.values(c.facets).some(Boolean),
  );
}
export function EntityEmpty<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const filtered = isFiltered(c);
  const custom = filtered ? {} : (config.emptyState ?? {});
  const Icon = config.emptyState?.icon ?? Inbox;
  const copy = {
    title: custom.title ?? t(filtered ? 'noMatches' : 'empty'),
    description: custom.description ?? t(filtered ? 'noMatchesDescription' : 'emptyDescription'),
    action: custom.action ?? {
      label: t(filtered ? 'clear' : 'create'),
      onSelect: () => (filtered ? c.clearFilters() : c.navigate({ new: '1' })),
    },
  };
  return (
    <div className="grid justify-items-center gap-3 px-6 py-16 text-center">
      <Icon className="size-7 text-text-muted" />
      <h2 className="text-base font-medium">{copy.title}</h2>
      <p className="max-w-sm text-sm text-text-muted">{copy.description}</p>
      <Button variant="outline" className="mt-1" onClick={copy.action.onSelect}>
        {copy.action.label}
      </Button>
    </div>
  );
}
