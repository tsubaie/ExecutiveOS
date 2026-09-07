'use client';
import { useTranslations } from 'next-intl';
import { Inbox } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './EntityControls';
import { useLeavingRows, type Rendered } from './use-leaving-rows';
export function EntityList<T extends Entity, P extends object, C>(props: Surface<T, P, C>) {
  const t = useTranslations('common');
  const { list } = props.controller;
  const rows = useLeavingRows(list.items, list.pending);
  if (list.pending) return <EntityListSkeleton />;
  if (list.error) return <ErrorPanel error={list.error} retry={list.refetch} />;
  if (!rows.length) return <EntityEmpty {...props} />;
  return (
    <>
      <ul>
        {rows.map((row, index) => (
          <EntityListRow key={row.item.id} {...props} rows={rows} row={row} index={index} />
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
// Placeholder rows at the real row height keep the layout stable while the first page loads.
function EntityListSkeleton() {
  const t = useTranslations('common');
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'];
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">{t('loading')}</span>
      {rows.map((row, index) => (
        <div key={row} aria-hidden className="flex h-11 items-center gap-3 border-b px-4">
          <span className="size-4 rounded-full bg-surface-raised" />
          <span
            className={cn(
              'h-3 rounded bg-surface-raised',
              index % 3 === 0 ? 'w-2/3' : index % 3 === 1 ? 'w-1/2' : 'w-3/5',
            )}
          />
          <span className="ms-auto h-3 w-12 rounded bg-surface-raised" />
        </div>
      ))}
    </div>
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
  const Icon = config.emptyState?.icon ?? Inbox;
  const copy = {
    title: custom.title ?? t(filtered ? 'noMatches' : 'empty'),
    description: custom.description ?? t(filtered ? 'noMatchesDescription' : 'emptyDescription'),
    action: custom.action ?? {
      label: t(filtered ? 'clear' : 'create'),
      onSelect: () => (filtered ? c.clearFilters() : c.navigate({ new: '1' })),
    },
  };
  return (
    <div className="grid justify-items-center gap-3 px-6 py-16 text-center">
      <Icon className="size-7 text-text-muted" />
      <h2 className="text-base font-medium">{copy.title}</h2>
      <p className="max-w-sm text-sm text-text-muted">{copy.description}</p>
      <Button variant="outline" className="mt-1" onClick={copy.action.onSelect}>
        {copy.action.label}
      </Button>
    </div>
  );
}
function EntityListRow<T extends Entity, P extends object, C>({
  config,
  controller: c,
  rows,
  row,
  index,
}: Surface<T, P, C> & { rows: Rendered<T>[]; row: Rendered<T>; index: number }) {
  const { item, leaving } = row;
  const current = !leaving && c.state.id === item.id;
  return (
    <li className={cn(leaving && 'entity-row-leaving')} inert={leaving || undefined}>
      <EntityGroupHeading config={config} rows={rows} index={index} />
      <div
        className={cn(
          'entity-row relative flex min-w-0 items-center border-b transition-colors',
          current ? 'bg-accent-soft' : 'hover:bg-surface-raised/50',
        )}
        data-current={current ? '' : undefined}
      >
        <EntityRowLead config={config} controller={c} item={item} />
        <Button
          data-row-id={leaving ? undefined : item.id}
          aria-current={current ? 'true' : undefined}
          variant="ghost"
          className={cn(
            'h-auto min-h-11 min-w-0 flex-1 justify-start rounded-none px-3 py-1.5 text-start hover:bg-transparent',
            !config.rowAction && !c.selecting && 'ps-4',
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

// The leading control: a selection checkbox in multi-select mode, otherwise the row action.
function EntityRowLead<T extends Entity, P extends object, C>({
  config,
  controller: c,
  item,
}: Surface<T, P, C> & { item: T }) {
  const t = useTranslations('common');
  return (
    <>
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
    </>
  );
}

// Group headers carry the count of loaded rows in the group (EP-B14).
function EntityGroupHeading<T extends Entity, P extends object, C>({
  config,
  rows,
  index,
}: Pick<Surface<T, P, C>, 'config'> & { rows: Rendered<T>[]; index: number }) {
  const count = useCount();
  const item = rows[index]?.item;
  const before = rows[index - 1]?.item;
  const heading = item ? config.group?.(item) : null;
  if (!heading || (before && heading === config.group?.(before))) return null;
  const size = rows.filter((row) => !row.leaving && config.group?.(row.item) === heading).length;
  return (
    <h2 className="flex h-7 items-baseline gap-2 border-b bg-surface-raised/60 px-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
      {heading}
      <span className="font-medium tracking-normal tabular-nums">{count(size)}</span>
    </h2>
  );
}
