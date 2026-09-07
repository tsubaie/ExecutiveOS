'use client';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { cn } from '@/ui/cn';
import { useEntityController } from './use-entity-controller';
import { EntityNavigationProvider } from './navigation';
import { EntityViews, EntityToolbar, EntityFacets, EntityOutside } from './EntityControls';
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
function EntitySurface<T extends Entity, P extends object, C>(props: EntityPageProps<T, P, C>) {
  const t = useTranslations('common');
  const root = useRef<HTMLElement>(null);
  const c = useEntityController(props, root);
  const panel = c.state.id || c.state.creating;
  return (
    <section ref={root} className={cn('entity-page min-w-0', panel && 'entity-page-open')}>
      <header
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-5 lg:px-6',
          panel && 'hidden lg:flex',
        )}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          <p className="mt-1 hidden text-sm text-text-muted sm:block">{props.description}</p>
        </div>
        <Button onClick={() => c.navigate({ new: '1' })}>
          <Plus className="size-4" />
          {t('create')}
        </Button>
      </header>
      <div className="entity-workspace flex min-h-0 flex-1 overflow-hidden border-t">
        {c.railOpen && (
          <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-e p-3 xl:block">
            <h2 className="mb-3 px-3 text-xs text-text-muted">{t('views')}</h2>
            <EntityViews config={props} controller={c} />
          </aside>
        )}
        <div
          data-entity-list
          className={cn('min-w-0 flex-1 overflow-y-auto', panel && 'hidden lg:block')}
        >
          <EntityToolbar config={props} controller={c} />
          <EntityList config={props} controller={c} />
        </div>
        {panel && (
          <aside className="entity-detail min-w-0 flex-1 overflow-y-auto bg-surface lg:w-[min(480px,50%)] lg:flex-none lg:border-s">
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
