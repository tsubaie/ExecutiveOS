'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { EntityPanel } from './EntityPanel';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
// The shape of a detail (title, a few property rows, a text block) while the item loads, so the
// panel reads as arriving rather than empty.
function EntityDetailSkeleton() {
  const t = useTranslations('common');
  const rows = ['a', 'b', 'c', 'd'];
  return (
    <div role="status" className="animate-pulse p-4 lg:p-5">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden className="grid gap-4">
        <div className="flex items-center gap-3">
          <span className="size-5 rounded-full bg-surface-raised" />
          <span className="h-6 w-3/4 rounded bg-surface-raised" />
        </div>
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="h-3 w-14 rounded bg-surface-raised" />
              <span className="h-9 rounded-lg bg-surface-raised" />
            </div>
          ))}
        </div>
        <span className="h-24 rounded-lg bg-surface-raised" />
      </div>
    </div>
  );
}
export function EntityContent<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  if (c.state.creating)
    return config.renderers.create({ cancel: c.close, pending: c.creating, submit: c.submit });
  if (c.detail.pending) return <EntityDetailSkeleton />;
  if (c.detail.error || !c.detail.data)
    return (
      <div className="grid gap-4 p-6">
        <p>{t('notFound')}</p>
        {c.detail.error && <ErrorPanel error={c.detail.error} />}
        <Button onClick={c.close}>{t('close')}</Button>
      </div>
    );
  return (
    <EntityPanel
      key={c.detail.data.id}
      item={c.detail.data}
      mutations={config.mutations}
      render={config.renderers.detail}
      name={config.renderers.name(c.detail.data)}
      close={c.close}
      reload={c.detail.refetch}
      move={c.move}
      neighbors={c.neighbors}
    />
  );
}
