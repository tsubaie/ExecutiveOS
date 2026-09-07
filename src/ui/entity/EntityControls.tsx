'use client';
import { useTranslations } from 'next-intl';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { cn } from '@/ui/cn';
import type { Entity, EntityPageProps } from './types';
import type { EntityController } from './use-entity-controller';
export type Surface<T extends Entity, P extends object, C> = {
  config: EntityPageProps<T, P, C>;
  controller: EntityController<T, P, C>;
};
export function EntityViews<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  return (
    <div className="space-y-1">
      {config.views.map((view) => (
        <Button
          key={view.id}
          variant="ghost"
          className={cn(
            'w-full justify-between text-text-muted',
            c.state.view === view.id && 'bg-surface-raised text-text',
          )}
          onClick={() => {
            c.navigate({ view: view.id }, true);
            c.setFiltersOpen(false);
          }}
        >
          <span>{view.label}</span>
          <span className="text-xs tabular-nums">{c.list.counts[view.id] ?? 0}</span>
        </Button>
      ))}
    </div>
  );
}
export function EntityToolbar<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <>
      <div className="flex items-center gap-2 border-b p-4">
        <Search className="size-4 shrink-0 text-text-muted" />
        <Input
          aria-label={t('search')}
          placeholder={t('search')}
          value={c.state.q}
          onChange={(event) => c.navigate({ q: event.target.value }, true)}
        />
        <Button
          variant="outline"
          className="lg:hidden"
          aria-label={t('filter')}
          onClick={() => c.setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>
      <EntityFacets config={config} controller={c} />
      {config.bulk && (
        <div className="border-b p-4">
          {config.bulk(
            c.list.items.filter((item) => c.selected.includes(item.id)),
            () => c.navigate({ sel: null }, true),
          )}
        </div>
      )}
      {c.state.id && !c.list.items.some((item) => item.id === c.state.id) && c.detail.data && (
        <div className="border-b bg-warning/10 p-3 text-sm">
          {t('outside')}
          <Button
            variant="ghost"
            onClick={() => c.navigate({ view: 'all', q: null, id: c.state.id }, true)}
          >
            {t('showAll')}
          </Button>
        </div>
      )}
    </>
  );
}
function EntityFacets<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  if (!config.filters) return null;
  return (
    <div className="flex flex-wrap gap-3 border-b p-4">
      {config.filters.map((filter) => (
        <label key={filter.key} className="grid min-w-0 flex-1 gap-1 text-xs text-text-muted">
          {filter.label}
          <NativeSelect
            aria-label={filter.label}
            value={c.facets[filter.key] ?? ''}
            onChange={(event) =>
              c.navigate({ [filter.key]: event.target.value, id: null, new: null, sel: null }, true)
            }
          >
            {filter.options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      ))}
    </div>
  );
}
