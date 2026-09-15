'use client';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, ListChecks, PanelLeftClose, CirclePlus, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { EntitySearch } from './EntitySearch';
import { EntityBulkBar } from './EntityBulkBar';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Entity, EntityPageProps } from './types';
import type { EntityController } from './use-entity-controller';
export type Surface<T extends Entity, P extends object, C> = {
  config: EntityPageProps<T, P, C>;
  controller: EntityController<T, P, C>;
};
// Card lists use a compact desktop toolbar; title and Create remain visible without a rail.
export function EntityToolbar<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <div className="sticky top-0 z-10 space-y-3 border-b bg-surface p-3">
      {config.renderers.rowStyle === 'card' && c.railOpen && <h1 className="sr-only hidden xl:block">{config.title}</h1>}
      <div className={cn('flex min-w-0 items-center gap-2', config.renderers.rowStyle === 'card' && c.railOpen && 'xl:hidden')}>
        <Button
          variant="ghost"
          size="icon"
          className="hidden xl:inline-flex"
          aria-label={t(c.railOpen ? 'collapseViews' : 'expandViews')}
          onClick={() => c.setRailOpen(!c.railOpen)}
        >
          <PanelLeftClose className="size-4 rtl:rotate-180" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <h1 className="shrink-0 text-lg font-semibold whitespace-nowrap">{config.title}</h1>
          <p className="sr-only">{config.description}</p>
          <EntityToolbarSummary config={config} controller={c} />
        </div>
        <Button className="shrink-0" onClick={() => c.navigate({ new: '1' })}>
          <CirclePlus className="size-5" strokeWidth={2.25} />
          {t('create')}
        </Button>
      </div>
      <EntityToolbarControls config={config} controller={c} />
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
        <FacetSelect
          label={
            sort.options.find((option) => option.id === '')?.label ?? sort.options[0]?.label ?? ''
          }
          value={c.state.sort}
          options={sort.options.map((option) => ({ value: option.id, label: option.label }))}
          onChange={(value) => change({ sort: value })}
        />
      )}
      {config.filters.facets?.map((filter) => (
        <FacetSelect
          key={filter.key}
          label={filter.label}
          value={c.facets[filter.key] ?? ''}
          options={filter.options}
          onChange={(value) => change({ [filter.key]: value })}
        />
      ))}
    </div>
  );
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-sm text-text-muted">
      <span>{label}</span>
      <ChoiceSelect
        items={options.map((option) => ({ ...option, text: option.label }))}
        value={value}
        label={label}
        onChange={onChange}
      />
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
  const filtered = count > 0 || Boolean(c.state.q) || c.state.view !== 'all';
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
      {config.renderers.rowStyle === 'card' && c.railOpen && <Button variant="ghost" size="icon" className="hidden xl:inline-flex"
        aria-label={t('collapseViews')} onClick={() => c.setRailOpen(false)}><PanelLeftClose className="size-4 rtl:rotate-180" /></Button>}
      <div className="flex min-w-0 flex-1 basis-full @lg:basis-0"><EntitySearch key={c.searchReset} query={c.state.q} navigate={c.navigate} /></div>
      <EntityMode config={config} controller={c} />
      {config.filters.sort && <div className="min-w-0 max-w-44">
        <ChoiceSelect label={t('sort')} value={c.state.sort}
          items={config.filters.sort.options.map((option) => ({ value: option.id, text: option.label, label: option.label }))}
          onChange={(sort) => c.navigate({ sort }, true)} />
      </div>}
      <Button
        variant={count ? 'secondary' : 'outline'}
        aria-label={count ? t('filtersActive', { count }) : t('filter')}
        onClick={() => c.setFiltersOpen(true)}
      >
        <SlidersHorizontal className="size-4" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </Button>
      <Button variant="ghost" size="icon" className={cn('shrink-0 text-text-muted', !filtered && 'invisible')} aria-label={t('clear')} title={t('clear')} onClick={() => c.clearFilters()}>
        <X aria-hidden={true} className="size-4" />
      </Button>
      <EntitySelectionControl config={config} controller={c} />
    </div>
  );
}

// EP-B28: the reading the whole list is taken under. A segmented group rather than a select,
// because the options are few, fixed and compared against each other — and because the record's
// own period toggle is this shape, so moving between the list and a record does not change how the
// same question is asked. It is not folded into the filter sheet: a filter shortens the list and
// this does not, and something that rewrites every figure on the page should not be behind a
// button that says how many filters are on.
function EntityMode<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const mode = config.filters.mode;
  if (!mode) return null;
  const current = c.facets[mode.key] ?? '';
  return (
    <div role="group" aria-label={mode.label} className="flex shrink-0 rounded-lg border p-0.5">
      {mode.options.map((option) => (
        <Button
          key={option.id}
          variant="ghost"
          size="sm"
          aria-pressed={option.id === current}
          className={cn(
            'h-7 px-2.5 text-xs font-normal text-text-muted',
            option.id === current && 'bg-surface-raised font-medium text-text',
          )}
          onClick={() => c.navigate({ [mode.key]: option.id, id: null, sel: null }, true)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

// The current view and its count double as the way into the filter sheet where the rail is hidden.
function EntityToolbarSummary<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const format = useCount();
  return <>
    <Button variant="ghost" size="sm"
      className="h-7 min-w-0 justify-start gap-1.5 px-1.5 text-sm font-normal text-text-muted"
      onClick={() => c.setFiltersOpen(true)}>
      <span className="truncate">{config.filters.views.find((view) => view.id === c.state.view)?.label}</span>
      <span className="tabular-nums">{format(c.list.counts[c.state.view] ?? 0)}</span>
    </Button>
    {config.filters.views.filter((view) => view.featured === 'compact' && view.id !== c.state.view).map((view) =>
      <Button key={view.id} variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2 text-xs font-normal text-text-muted"
        onClick={() => c.navigate({ view: view.id }, true)}>
        <span>{view.label}</span><span className="tabular-nums">{format(c.list.counts[view.id] ?? 0)}</span>
      </Button>)}
  </>;
}

function EntitySelectionControl<T extends Entity, P extends object, C>({ config, controller: c }: Surface<T, P, C>) {
  const t = useTranslations('common');
  return <>
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
  </>;
}
