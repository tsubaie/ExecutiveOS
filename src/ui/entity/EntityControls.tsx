'use client';
import { useTranslations } from 'next-intl';
import {
  SlidersHorizontal,
  ListChecks,
  PanelLeftClose,
  CirclePlus,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { EntitySearch } from './EntitySearch';
import { EntityModes } from './EntityModes';
import { EntityBulkBar } from './EntityBulkBar';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './surface';

// EP-B22: one header, the same on every entity surface. Create used to move into the views rail
// for card lists and stay in the bar for everything else, which made where the primary action
// lives a function of how the rows happen to be drawn — two modules of the same framework putting
// it in two places. It is at the head of the rail on all of them now, and the bar carries it only
// where there is no rail to carry it: a heading row with a lone button at the far end leaves a
// thousand pixels of nothing between the two on a wide screen.
//
// EP-B32: the title and the controls are two flex items of one wrapping row, not two rows. They
// share a line wherever the list is wide enough to hold both and the controls drop below the title
// where it is not, so the bar is one row on a desktop and two on a phone without either width
// being written down. It was two rows at every width before, and on a 390 px screen that put 359 px
// of header over two and a half task rows.
// The title takes only the width it needs once there is a row to share, so the spare goes to the
// controls rather than to the gap after the heading -- a module carrying a mode as well as a sort
// (KPIs) needs all of it to stay on one line. Below that it grows again, which is what holds
// Create against the end edge of a phone.
export function EntityToolbar<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <div className="entity-toolbar sticky top-0 z-10 space-y-3 border-b bg-surface p-3">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-auto items-center gap-2 @lg:flex-none">
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
          <Button
            className={cn('shrink-0', c.railOpen && 'xl:hidden')}
            onClick={() => c.navigate({ new: '1' })}
          >
            <CirclePlus className="size-5" strokeWidth={2.25} />
            {t('create')}
          </Button>
        </div>
        <EntityToolbarControls config={config} controller={c} />
      </div>
      {config.bulkActions?.length && c.selecting && c.selected.length > 0 ? (
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
// What the Filter button reports and what Clear has to clear are two different questions.
// EP-B33 a sort is neither: it reorders the list and never shortens it. EP-B28 the mode is the
// second: it shares the facets' URL key and their clearing and is still not a filter, so it is
// cleared but not counted -- which is also why a change of period no longer grows the button by a
// badge and shifts everything sharing the row with it.
function narrowing<T extends Entity, P extends object, C>(
  config: Surface<T, P, C>['config'],
  c: Surface<T, P, C>['controller'],
) {
  const mode = config.filters.mode?.key;
  const count = Object.entries(c.facets).filter(([key, value]) => value && key !== mode).length;
  const active = Boolean(mode && c.facets[mode]);
  return { count, filtered: count > 0 || active || Boolean(c.state.q) || c.state.view !== 'all' };
}

// Search, filters and selection mode; wraps under the title when the list column is narrow
// (a phone, or the desktop list beside an open detail).
//
// EP-B34: while a record is open the panel covers the end of the list, and everything under it was
// still focusable — Tab walked into controls nobody could see. The bar keeps only what fits in the
// strip the panel leaves: search and Filter. The rest are list-wide settings the reader is not
// adjusting while working on one record, and they come back the moment it closes.
function EntityToolbarControls<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const covered = Boolean(c.state.id || c.state.creating);
  const { count, filtered } = narrowing(config, c);
  return (
    <div className="flex min-w-0 flex-[2_1_30rem] flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 basis-56">
        <EntitySearch key={c.searchReset} query={c.state.q} navigate={c.navigate} />
      </div>
      <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2">
        {!covered && <EntityListSettings config={config} controller={c} />}
        <Button
          variant={count ? 'secondary' : 'outline'}
          className="shrink-0"
          aria-label={count ? t('filtersActive', { count }) : t('filter')}
          onClick={() => c.setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" aria-hidden={true} />
          <span>{t('filter')}</span>
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </Button>
        {!covered && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('shrink-0 text-text-muted', !filtered && 'invisible')}
            aria-label={t('clear')}
            title={t('clear')}
            onClick={() => c.clearFilters()}
          >
            <X aria-hidden={true} className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Everything in the bar that is not search, Filter or Clear: how the list is drawn, the reading it
// is taken under, the order it is in, and whether rows are being picked. All of it is hidden while
// a record is open (EP-B34), so it travels together.
function EntityListSettings<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <>
      <EntityModes config={config} controller={c} />
      {config.filters.sort && (
        <div className="min-w-0 max-w-44">
          <ChoiceSelect
            label={t('sort')}
            value={c.state.sort}
            items={config.filters.sort.options.map((option) => ({
              value: option.id,
              text: option.label,
              label: option.label,
            }))}
            onChange={(sort) => c.navigate({ sort }, true)}
          />
        </div>
      )}
      <EntitySelectionControl config={config} controller={c} />
    </>
  );
}

// The current view and its count. EP-B35: it is the way into the filter sheet, so it wears a
// chevron and says so; and it is gone wherever the rail is showing the same view and the same
// count thirty pixels away, which on a desktop it always is.
function EntityToolbarSummary<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const format = useCount();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 min-w-0 justify-start gap-1.5 px-1.5 text-sm font-normal text-text-muted',
          c.railOpen && 'xl:hidden',
        )}
        onClick={() => c.setFiltersOpen(true)}
      >
        <span className="truncate">
          {config.filters.views.find((view) => view.id === c.state.view)?.label}
        </span>
        <span className="tabular-nums">{format(c.list.counts[c.state.view] ?? 0)}</span>
        <ChevronDown aria-hidden={true} className="size-3.5 opacity-70" />
      </Button>
      {config.filters.views
        .filter((view) => view.featured === 'compact' && view.id !== c.state.view)
        .map((view) => (
          <Button
            key={view.id}
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-2 text-xs font-normal text-text-muted"
            onClick={() => c.navigate({ view: view.id }, true)}
          >
            <span>{view.label}</span>
            <span className="tabular-nums">{format(c.list.counts[view.id] ?? 0)}</span>
          </Button>
        ))}
    </>
  );
}

function EntitySelectionControl<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  return (
    <>
      {config.bulkActions?.length ? (
        <Button
          variant={c.selecting ? 'secondary' : 'ghost'}
          size="icon"
          className="shrink-0"
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
    </>
  );
}
