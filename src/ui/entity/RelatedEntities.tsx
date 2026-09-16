'use client';
import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { EntityPanel } from './EntityPanel';
import { useEntityNavigation } from './navigation';
import type { Entity, EntityPageProps, Filters } from './types';
// One embedded workflow for linked work: reuse each module's rows, create form and detail panel.
export function RelatedEntities<T extends Entity, P extends object, C>({ config, filters, allowCreate = true }: {
  config: EntityPageProps<T, P, C>; filters: Filters; allowCreate?: boolean;
}) {
  const c = useTranslations('common');
  const guarded = useEntityNavigation();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState(filters.view);
  const list = config.useList({ ...filters, view });
  const detail = config.useDetail(selected, false);
  const close = () => guarded(() => { setSelected(null); setCreating(false); });
  const submit = async (input: C) => {
    setPending(true);
    try {
      const item = await config.mutations.create(input);
      if (item) { setCreating(false); setSelected(item.id); }
      return item;
    } finally { setPending(false); }
  };
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <ChoiceSelect label={config.title} value={view} onChange={setView}
        items={config.filters.views.map((item) => ({ value: item.id, text: item.label, label: item.label }))} />
      <Button size="sm" disabled={!allowCreate} onClick={() => guarded(() => setCreating(true))}>{c('create')}</Button>
    </div>
    {list.pending && <Loading />}
    {list.error && <ErrorPanel error={list.error} retry={list.refetch} />}
    {!list.pending && !list.items.length && <p className="py-4 text-sm text-text-muted">{c('noMatches')}</p>}
    <ul className="space-y-2">{list.items.map((item, index) => <Fragment key={item.id}>
      {config.group?.(item) && (index === 0 || config.group(item) !== config.group(list.items[index - 1] ?? item)) &&
        <li className="pt-3 pb-1 text-xs font-medium text-text-muted">{config.group(item)}</li>}
      <li className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
      {config.rowAction?.(item)}
      <Button variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 justify-start text-start" onClick={() => guarded(() => setSelected(item.id))}>
        {config.renderers.row(item)}
      </Button>
      <div className="ms-auto text-xs">{config.renderers.rowTrail?.(item)}</div>
    </li></Fragment>)}</ul>
    {list.more && <Button variant="ghost" onClick={() => void list.fetchMore()}>{c('more')}</Button>}
    <Dialog open={creating || selected !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">{config.title}</DialogTitle><DialogDescription className="sr-only">{config.description}</DialogDescription>
        {creating ? config.renderers.create({ pending, cancel: close, submit }) : detail.pending ? <Loading /> : detail.error ? <ErrorPanel error={detail.error} /> : detail.data ?
          <EntityPanel item={detail.data} name={config.renderers.name(detail.data)} deletedMessage={config.renderers.deletedMessage} mutations={config.mutations} render={config.renderers.detail}
            reload={detail.refetch} close={close} move={() => undefined} neighbors={{ previous: false, next: false, position: 1, count: 1 }} /> : null}
      </DialogContent>
    </Dialog>
  </section>;
}
