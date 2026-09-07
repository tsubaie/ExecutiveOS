'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import Loading from '@/ui/layout/Loading';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { EntityPanel } from './EntityPanel';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
export function EntityContent<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  if (c.state.creating)
    return config.renderers.create({ cancel: c.close, pending: c.creating, submit: c.submit });
  if (c.detail.pending) return <Loading />;
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
