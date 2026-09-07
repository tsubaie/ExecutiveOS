'use client';
import { useRef } from 'react';
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
          <aside className="entity-detail min-w-0 flex-1 overflow-y-auto bg-surface lg:w-[min(480px,50%)] lg:flex-none lg:rounded-xl lg:border">
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
