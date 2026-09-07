'use client';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, ListChecks, PanelLeftClose, Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { EntitySearch } from './EntitySearch';
import { EntityBulkBar } from './EntityBulkBar';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { useCount } from '@/ui/format';
import type { Entity, EntityPageProps } from './types';
import type { EntityController } from './use-entity-controller';
export type Surface<T extends Entity, P extends object, C> = {
  config: EntityPageProps<T, P, C>;
  controller: EntityController<T, P, C>;
};
// Title and current view lead, search, filter and selection follow, and Create closes the bar at
// its trailing end; when the bar wraps (a phone, or beside an open detail) Create stays on the
// title row so the primary action never drops below the fold.
export function EntityToolbar<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <div className="sticky top-0 z-10 border-b bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
        <Button
          variant="ghost"
          size="icon"
          className="hidden xl:inline-flex"
          aria-label={t(c.railOpen ? 'collapseViews' : 'expandViews')}
          onClick={() => c.setRailOpen(!c.railOpen)}
        >
          <PanelLeftClose className="size-4 rtl:rotate-180" />
        </Button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="shrink-0 text-lg font-semibold whitespace-nowrap">{config.title}</h1>
          <p className="sr-only">{config.description}</p>
          <EntityToolbarSummary config={config} controller={c} />
        </div>
        <Button className="@2xl:order-last" onClick={() => c.navigate({ new: '1' })}>
          <Plus className="size-4" />
          {t('create')}
        </Button>
        <EntityToolbarControls config={config} controller={c} />
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

// Search, filters and selection mode; wraps under the title when the list column is narrow
// (a phone, or the desktop list beside an open detail).
function EntityToolbarControls<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const count = Object.values(c.facets).filter(Boolean).length + (c.state.sort ? 1 : 0);
  return (
    <div className="flex w-full min-w-0 items-center gap-2 @2xl:w-auto @2xl:flex-1 @2xl:basis-[260px] @2xl:justify-end">
      <EntitySearch query={c.state.q} navigate={c.navigate} />
      <Button
        variant={count ? 'secondary' : 'outline'}
        aria-label={count ? t('filtersActive', { count }) : t('filter')}
        onClick={() => c.setFiltersOpen(true)}
      >
        <SlidersHorizontal className="size-4" />
        <span className="hidden @lg:inline">{t('filter')}</span>
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </Button>
      {config.bulkActions?.length ? (
        <Button
          variant={c.selecting ? 'secondary' : 'ghost'}
          size="icon"
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
  );
}

// The current view and its count double as the way into the filter sheet where the rail is hidden.
function EntityToolbarSummary<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const format = useCount();
  const filtered = Object.values(c.facets).some(Boolean) || Boolean(c.state.sort) || c.state.q;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 min-w-0 justify-start gap-1.5 px-1.5 text-sm font-normal text-text-muted"
        onClick={() => c.setFiltersOpen(true)}
      >
        <span className="truncate">
          {config.filters.views.find((view) => view.id === c.state.view)?.label}
        </span>
        <span className="tabular-nums">{format(c.list.counts[c.state.view] ?? 0)}</span>
      </Button>
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-xs text-text-muted"
          onClick={() => c.clearFilters()}
        >
          {t('clear')}
        </Button>
      )}
    </>
  );
}
