'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import type { Entity } from './types';
import type { Surface } from './surface';
// EP-B03: a record deep-linked from outside the filtered list still opens, and the list says so
// rather than leaving the reader to wonder why the row they are looking at is not among the rows.
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
