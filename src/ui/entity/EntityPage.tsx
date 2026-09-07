'use client';
import { useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Search, SlidersHorizontal, Users } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Dialog, DialogContent, DialogTitle } from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
import { cn } from '@/ui/cn';
import { resolveUrlState, changeUrl } from './url-state';
import { EntityPanel } from './EntityPanel';
import type { Entity, EntityPageProps } from './types';

export function EntityPage<T extends Entity, P extends object, C>(props: EntityPageProps<T, P, C>) {
  const t = useTranslations('common');
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const state = resolveUrlState(new URLSearchParams(params));
  const list = props.useList({ view: state.view, q: state.q });
  const detail = props.useDetail(state.id, state.view === 'trash');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(0);
  const navigate = (patch: Record<string, string | null>, replace = false) => {
    const query = changeUrl(new URLSearchParams(window.location.search), patch);
    router[replace ? 'replace' : 'push'](`${path}${query ? '?' + query : ''}`, { scroll: false });
  };
  const close = () => {
    navigate({ id: null, new: null });
    const row = list.items[focused];
    if (row)
      document.querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(row.id)}"]`)?.focus();
  };
  const move = (direction: number) => {
    const index = list.items.findIndex((item) => item.id === state.id);
    const next = list.items[index + direction];
    if (next) navigate({ id: next.id }, true);
    else if (direction > 0 && list.more) void list.fetchMore();
  };
  function keyboard(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input,textarea,select,[contenteditable=true]')
    )
      return;
    if (['ArrowDown', 'j', 'ArrowUp', 'k'].includes(event.key)) {
      event.preventDefault();
      const index = Math.max(
        0,
        Math.min(
          list.items.length - 1,
          focused + (['ArrowDown', 'j'].includes(event.key) ? 1 : -1),
        ),
      );
      setFocused(index);
      const item = list.items[index];
      if (item)
        document
          .querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(item.id)}"]`)
          ?.focus();
    }
    if (event.key === 'n') {
      event.preventDefault();
      navigate({ new: '1' });
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (state.id || state.creating) close();
      else navigate({ q: null, view: null }, true);
    }
  }
  const views = (
    <div className="space-y-1">
      {props.views.map((view) => (
        <Button
          key={view.id}
          variant="ghost"
          className={cn(
            'w-full justify-between text-text-muted',
            state.view === view.id && 'bg-surface-raised text-text',
          )}
          onClick={() => {
            navigate({ view: view.id }, true);
            setFiltersOpen(false);
          }}
        >
          <span>{view.label}</span>
          <span className="text-xs tabular-nums">{list.counts[view.id] ?? 0}</span>
        </Button>
      ))}
    </div>
  );
  const panel = state.id || state.creating;
  return (
    <section onKeyDown={keyboard} className="min-w-0 overflow-x-clip">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-7 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          <p className="mt-2 text-sm text-text-muted">{props.description}</p>
        </div>
        <Button onClick={() => navigate({ new: '1' })}>
          <Plus className="size-4" />
          {t('create')}
        </Button>
      </header>
      <div className="flex min-h-[70dvh] border-t lg:h-[calc(100dvh-196px)] lg:min-h-0">
        <aside className="hidden w-60 shrink-0 border-e p-4 lg:block">
          <h2 className="mb-3 px-3 text-xs text-text-muted">{t('views')}</h2>
          {views}
        </aside>
        <div className={cn('min-w-0 flex-1 overflow-y-auto', panel && 'hidden lg:block')}>
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="size-4 shrink-0 text-text-muted" />
            <Input
              aria-label={t('search')}
              placeholder={t('search')}
              value={state.q}
              onChange={(event) => navigate({ q: event.target.value }, true)}
            />
            <Button
              variant="outline"
              className="lg:hidden"
              aria-label={t('filter')}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
          {state.id && !list.items.some((item) => item.id === state.id) && detail.data && (
            <div className="border-b bg-warning/10 p-3 text-sm">
              {t('outside')}
              <Button
                variant="ghost"
                onClick={() => navigate({ view: 'all', q: null, id: state.id }, true)}
              >
                {t('showAll')}
              </Button>
            </div>
          )}
          {list.pending ? (
            <Loading />
          ) : list.error ? (
            <ErrorPanel error={list.error} retry={list.refetch} />
          ) : list.items.length === 0 ? (
            <div className="grid justify-items-center gap-4 px-6 py-16 text-center">
              <Users className="size-8 text-text-muted" />
              <h2 className="text-lg font-medium">
                {state.q || state.view !== 'all' ? t('noMatches') : t('empty')}
              </h2>
              <p className="max-w-sm text-sm text-text-muted">{t('emptyDescription')}</p>
              <Button
                variant="outline"
                onClick={() =>
                  state.q || state.view !== 'all'
                    ? navigate({ q: null, view: null }, true)
                    : navigate({ new: '1' })
                }
              >
                {state.q || state.view !== 'all' ? t('clear') : t('create')}
              </Button>
            </div>
          ) : (
            <ul>
              {list.items.map((item, index) => (
                <li key={item.id}>
                  <Button
                    data-row-id={item.id}
                    variant="ghost"
                    className={cn(
                      'h-auto min-h-20 w-full justify-start rounded-none border-b px-5 py-4 text-start',
                      state.id === item.id && 'bg-accent/10',
                    )}
                    onFocus={() => setFocused(index)}
                    onClick={() => navigate({ id: item.id })}
                  >
                    {props.renderers.row(item)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {list.more && (
            <Button variant="ghost" className="m-4" onClick={() => void list.fetchMore()}>
              {t('more')}
            </Button>
          )}
        </div>
        {panel && (
          <aside className="entity-detail min-w-0 flex-1 overflow-y-auto bg-surface lg:w-[480px] lg:flex-none lg:border-s">
            {state.creating ? (
              props.renderers.create({
                cancel: close,
                pending: creating,
                submit: async (input) => {
                  setCreating(true);
                  try {
                    const item = await props.mutations.create(input);
                    if (item) navigate({ id: item.id, new: null });
                    return item;
                  } finally {
                    setCreating(false);
                  }
                },
              })
            ) : detail.pending ? (
              <Loading />
            ) : detail.error || !detail.data ? (
              <div className="grid gap-4 p-6">
                <p>{t('notFound')}</p>
                {detail.error && <ErrorPanel error={detail.error} />}
                <Button onClick={close}>{t('close')}</Button>
              </div>
            ) : (
              <EntityPanel
                key={detail.data.id}
                item={detail.data}
                mutations={props.mutations}
                render={props.renderers.detail}
                name={props.renderers.name(detail.data)}
                close={close}
                move={move}
              />
            )}
          </aside>
        )}
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogTitle>{t('views')}</DialogTitle>
          {views}
        </DialogContent>
      </Dialog>
    </section>
  );
}
