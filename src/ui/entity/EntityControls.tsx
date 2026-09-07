'use client';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, ListChecks, PanelLeftClose } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { EntitySearch } from './EntitySearch';
import { EntityBulkBar } from './EntityBulkBar';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { cn } from '@/ui/cn';
import { useCount } from '@/ui/format';
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
  const count = useCount();
  return (
    <div className="space-y-1">
      {config.filters.views.map((view) => (
        <Button
          key={view.id}
          variant="ghost"
          aria-pressed={c.state.view === view.id}
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
          <span className="text-xs tabular-nums">{count(c.list.counts[view.id] ?? 0)}</span>
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
  const count = Object.values(c.facets).filter(Boolean).length + (c.state.sort ? 1 : 0);
  return (
    <div className="sticky top-0 z-10 border-b bg-background p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          className="hidden xl:inline-flex"
          aria-label={t(c.railOpen ? 'collapseViews' : 'expandViews')}
          onClick={() => c.setRailOpen(!c.railOpen)}
        >
          <PanelLeftClose className="size-4 rtl:rotate-180" />
        </Button>
        <EntitySearch query={c.state.q} navigate={c.navigate} />
        <Button
          variant={count ? 'secondary' : 'outline'}
          aria-label={count ? t('filtersActive', { count }) : t('filter')}
          onClick={() => c.setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          {count > 0 && <span>{count}</span>}
        </Button>
        {config.bulkActions?.length ? (
          <Button
            variant={c.selecting ? 'secondary' : 'ghost'}
            aria-label={t(c.selecting ? 'doneSelecting' : 'select')}
            aria-pressed={c.selecting}
            onClick={() => {
              c.setSelecting(!c.selecting);
              c.navigate({ sel: null }, true);
            }}
          >
            <ListChecks className="size-4" />
          </Button>
        ) : null}
      </div>
      <EntityToolbarSummary config={config} controller={c} />
    </div>
  );
}
export function EntityOutside<T extends Entity, P extends object, C>({
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  if (
    !c.state.id ||
    c.list.pending ||
    c.list.items.some((item) => item.id === c.state.id) ||
    !c.detail.data
  )
    return null;
  return (
    <div className="border-b bg-warning/10 p-3 text-sm">
      <span>{t('outside')}</span>
      <Button variant="ghost" onClick={() => c.clearFilters(c.state.id)}>
        {t('showAll')}
      </Button>
    </div>
  );
}
export function EntityFacets<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const sort = config.filters.sort;
  const change = (patch: Record<string, string | null>) =>
    c.navigate({ ...patch, id: null, new: null, sel: null }, true);
  return (
    <div className="grid gap-3">
      {sort && (
        <label className="grid min-w-0 gap-1 text-sm text-text-muted">
          {sort.options.find((option) => option.id === '')?.label ?? sort.options[0]?.label}
          <NativeSelect
            aria-label={sort.options.find((option) => option.id === '')?.label}
            value={c.state.sort}
            onChange={(event) => change({ sort: event.target.value })}
          >
            {sort.options.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      )}
      {config.filters.facets?.map((filter) => (
        <label key={filter.key} className="grid min-w-0 gap-1 text-sm text-text-muted">
          {filter.label}
          <NativeSelect
            aria-label={filter.label}
            value={c.facets[filter.key] ?? ''}
            onChange={(event) => change({ [filter.key]: event.target.value })}
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

function EntityToolbarSummary<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const format = useCount();
  const filtered = Object.values(c.facets).some(Boolean) || Boolean(c.state.sort) || c.state.q;
  return (
    <>
      {' '}
      <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-1 text-xs text-text-muted">
        <Button
          variant="ghost"
          className="min-w-0 justify-start text-xs"
          onClick={() => c.setFiltersOpen(true)}
        >
          {config.filters.views.find((view) => view.id === c.state.view)?.label}
          <span className="tabular-nums">{format(c.list.counts[c.state.view] ?? 0)}</span>
        </Button>
        {filtered && (
          <Button variant="ghost" className="text-xs" onClick={() => c.clearFilters()}>
            {t('clear')}
          </Button>
        )}
      </div>
      {config.bulkActions?.length && c.selecting ? (
        <EntityBulkBar
          items={c.list.items.filter((item) => c.selected.includes(item.id))}
          actions={config.bulkActions}
          clear={() => {
            c.navigate({ sel: null }, true);
            c.setSelecting(false);
          }}
        />
      ) : null}
    </>
  );
}
