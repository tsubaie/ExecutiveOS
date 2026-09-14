'use client';
import { useRef } from 'react';
import { CirclePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { cn } from '@/ui/cn';
import { useEntityController } from './use-entity-controller';
import { EntityNavigationProvider } from './navigation';
import { EntityToolbar, EntityFacets, EntityOutside } from './EntityControls';
import { EntityViews, EntityStats } from './EntityViews';
import { EntityList } from './EntityList';
import { EntityContent } from './EntityContent';
import type { Entity, EntityPageProps } from './types';
export function EntityPage<T extends Entity, P extends object, C>(props: EntityPageProps<T, P, C>) {
  return (
    <EntityNavigationProvider>
      <EntitySurface {...props} />
    </EntityNavigationProvider>
  );
}
// Rail, list and detail sit as rounded surfaces on the page ground from 1024 px; the list column
// opens with one bar carrying the title, current view, search, filters and Create (EP-B07).
// EP-B23: an open record is the subject of the page, so the detail carries the wider of the two
// columns and the list becomes the index beside it. The share is of the whole workspace, rail
// included, which is why 46 % reads as roughly 55/45 against the list. 480 px stays the floor, so
// no window width loses room against the fixed panel this replaces, and 880 px is the ceiling
// because a property form wider than that stops being readable.
function EntitySurface<T extends Entity, P extends object, C>(props: EntityPageProps<T, P, C>) {
  const t = useTranslations('common');
  const root = useRef<HTMLElement>(null);
  const c = useEntityController(props, root);
  const panel = c.state.id || c.state.creating;
  return (
    <section
      ref={root}
      className={cn(
        'entity-page min-w-0',
        panel && 'entity-page-open',
        c.state.creating && 'entity-page-creating',
      )}
    >
      <div className="entity-workspace flex min-h-0 flex-1 overflow-hidden lg:gap-3 lg:p-3">
        {c.railOpen && (
          <aside className="entity-rail hidden w-[208px] shrink-0 overflow-y-auto rounded-xl border bg-surface px-2 py-3 xl:block">
            {props.renderers.rowStyle === 'card' && <Button className="mb-5 w-full" onClick={() => c.navigate({ new: '1' })}>
              <CirclePlus className="size-4" aria-hidden={true} />{t('create')}
            </Button>}
            <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              {t('views')}
            </h2>
            <EntityViews config={props} controller={c} />
          </aside>
        )}
        <div
          data-entity-list
          className={cn(
            '@container min-w-0 flex-1 overflow-y-auto bg-surface lg:rounded-xl lg:border',
            panel && 'hidden lg:block',
          )}
        >
          <EntityToolbar config={props} controller={c} />
          <EntityStats config={props} controller={c} />
          <EntityList config={props} controller={c} />
        </div>
        {panel && (
          <aside className="entity-detail min-w-0 flex-1 overflow-y-auto bg-surface lg:w-[clamp(480px,46%,880px)] lg:flex-none lg:rounded-xl lg:border">
            <EntityOutside config={props} controller={c} />
            <EntityContent config={props} controller={c} />
          </aside>
        )}
      </div>
      <Dialog open={c.filtersOpen} onOpenChange={c.setFiltersOpen}>
        <DialogContent sheet className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>{t('filter')}</DialogTitle>
          <DialogDescription>{t('filterDescription')}</DialogDescription>
          <EntityFacets config={props} controller={c} />
          <h2 className="border-t pt-4 font-medium">{t('views')}</h2>
          <EntityViews config={props} controller={c} />
          <Button variant="outline" onClick={() => c.clearFilters()}>
            {t('clear')}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
