'use client';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle } from '@/ui/primitives/dialog';
import { cn } from '@/ui/cn';
import { useEntityController } from './use-entity-controller';
import { EntityViews, EntityToolbar } from './EntityControls';
import { EntityList } from './EntityList';
import { EntityContent } from './EntityContent';
import type { Entity, EntityPageProps } from './types';
export function EntityPage<T extends Entity, P extends object, C>(props: EntityPageProps<T, P, C>) {
  const t = useTranslations('common');
  const root = useRef<HTMLElement>(null);
  const c = useEntityController(props, root);
  const panel = c.state.id || c.state.creating;
  return (
    <section ref={root} className="min-w-0 overflow-x-clip">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-7 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          <p className="mt-2 text-sm text-text-muted">{props.description}</p>
        </div>
        <Button onClick={() => c.navigate({ new: '1' })}>
          <Plus className="size-4" />
          {t('create')}
        </Button>
      </header>
      <div className="flex min-h-[70dvh] border-t lg:h-[calc(100dvh-196px)] lg:min-h-0">
        <aside className="hidden w-60 shrink-0 border-e p-4 lg:block">
          <h2 className="mb-3 px-3 text-xs text-text-muted">{t('views')}</h2>
          <EntityViews config={props} controller={c} />
        </aside>
        <div className={cn('min-w-0 flex-1 overflow-y-auto', panel && 'hidden lg:block')}>
          <EntityToolbar config={props} controller={c} />
          <EntityList config={props} controller={c} />
        </div>
        {panel && (
          <aside className="entity-detail min-w-0 flex-1 overflow-y-auto bg-surface lg:w-[480px] lg:flex-none lg:border-s">
            <EntityContent config={props} controller={c} />
          </aside>
        )}
      </div>
      <Dialog open={c.filtersOpen} onOpenChange={c.setFiltersOpen}>
        <DialogContent>
          <DialogTitle>{t('views')}</DialogTitle>
          <EntityViews config={props} controller={c} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
