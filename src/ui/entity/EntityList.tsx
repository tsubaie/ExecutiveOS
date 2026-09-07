'use client';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import Loading from '@/ui/layout/Loading';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
export function EntityList<T extends Entity, P extends object, C>(props: Surface<T, P, C>) {
  const t = useTranslations('common');
  const { list } = props.controller;
  if (list.pending) return <Loading />;
  if (list.error) return <ErrorPanel error={list.error} retry={list.refetch} />;
  if (!list.items.length) return <EntityEmpty {...props} />;
  return (
    <>
      <ul>
        {list.items.map((item, index) => (
          <EntityListRow key={item.id} {...props} item={item} index={index} />
        ))}
      </ul>
      {list.more && (
        <Button variant="ghost" className="m-4" onClick={() => void list.fetchMore()}>
          {t('more')}
        </Button>
      )}
    </>
  );
}
function isFiltered<T extends Entity, P extends object, C>(c: Surface<T, P, C>['controller']) {
  return Boolean(
    c.state.q || c.state.sort || c.state.view !== 'all' || Object.values(c.facets).some(Boolean),
  );
}
export function EntityEmpty<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  const filtered = isFiltered(c);
  const custom = filtered ? {} : (config.emptyState ?? {});
  const copy = {
    title: custom.title ?? t(filtered ? 'noMatches' : 'empty'),
    description: custom.description ?? t(filtered ? 'noMatchesDescription' : 'emptyDescription'),
    action: custom.action ?? {
      label: t(filtered ? 'clear' : 'create'),
      onSelect: () => (filtered ? c.clearFilters() : c.navigate({ new: '1' })),
    },
  };
  return (
    <div className="grid justify-items-center gap-4 px-6 py-16 text-center">
      <Users className="size-8 text-text-muted" />
      <h2 className="text-lg font-medium">{copy.title}</h2>
      <p className="max-w-sm text-sm text-text-muted">{copy.description}</p>
      <Button variant="outline" onClick={copy.action.onSelect}>
        {copy.action.label}
      </Button>
    </div>
  );
}
function EntityListRow<T extends Entity, P extends object, C>({
  config,
  controller: c,
  item,
  index,
}: Surface<T, P, C> & { item: T; index: number }) {
  const t = useTranslations('common');
  return (
    <li>
      <EntityGroupHeading config={config} controller={c} item={item} index={index} />
      <div className="flex min-w-0 items-center border-b">
        {config.bulkActions?.length && c.selecting ? (
          <Checkbox
            className="entity-check ms-1 shrink-0"
            aria-label={t('selectItem', { name: config.renderers.name(item) })}
            checked={c.selected.includes(item.id)}
            onCheckedChange={(checked) =>
              c.navigate(
                {
                  sel: (checked
                    ? [...c.selected, item.id]
                    : c.selected.filter((id) => id !== item.id)
                  ).join(','),
                },
                true,
              )
            }
          />
        ) : null}
        {config.rowAction && !c.selecting && (
          <div className="ms-1 shrink-0">{config.rowAction(item)}</div>
        )}
        <Button
          data-row-id={item.id}
          aria-current={c.state.id === item.id ? 'true' : undefined}
          variant="ghost"
          className={cn(
            'h-auto min-h-20 min-w-0 flex-1 justify-start rounded-none px-3 py-3 text-start',
            c.state.id === item.id && 'bg-surface ring-1 ring-inset ring-accent/40',
          )}
          onFocus={() => c.setFocused(index)}
          onClick={() => c.navigate({ id: item.id })}
        >
          {config.renderers.row(item)}
        </Button>
      </div>
    </li>
  );
}

function EntityGroupHeading<T extends Entity, P extends object, C>({
  config,
  controller: c,
  item,
  index,
}: Surface<T, P, C> & { item: T; index: number }) {
  const heading = c.state.sort ? null : config.group?.(item);
  if (!heading || (index > 0 && heading === config.group?.(c.list.items[index - 1] ?? item)))
    return null;
  return (
    <h2 className="border-b bg-surface-raised px-5 py-2 text-xs font-semibold text-text-muted">
      {heading}
    </h2>
  );
}
