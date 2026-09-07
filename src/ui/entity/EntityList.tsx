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
function EntityEmpty<T extends Entity, P extends object, C>({ controller: c }: Surface<T, P, C>) {
  const t = useTranslations('common');
  const filtered = c.state.q || c.state.view !== 'all';
  return (
    <div className="grid justify-items-center gap-4 px-6 py-16 text-center">
      <Users className="size-8 text-text-muted" />
      <h2 className="text-lg font-medium">{t(filtered ? 'noMatches' : 'empty')}</h2>
      <p className="max-w-sm text-sm text-text-muted">{t('emptyDescription')}</p>
      <Button
        variant="outline"
        onClick={() =>
          filtered ? c.navigate({ q: null, view: 'all' }, true) : c.navigate({ new: '1' })
        }
      >
        {t(filtered ? 'clear' : 'create')}
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
  const heading = config.group?.(item);
  const showHeading =
    heading && (index === 0 || heading !== config.group?.(c.list.items[index - 1] ?? item));
  return (
    <li>
      {showHeading && (
        <h2 className="border-b bg-surface-raised px-5 py-2 text-xs font-semibold text-text-muted">
          {heading}
        </h2>
      )}
      <div className="flex min-w-0 items-center border-b">
        {config.bulk && (
          <Checkbox
            className="ms-4 shrink-0 rounded-full"
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
        )}
        {config.rowAction && <div className="ms-3 shrink-0">{config.rowAction(item)}</div>}
        <Button
          data-row-id={item.id}
          variant="ghost"
          className={cn(
            'h-auto min-h-20 min-w-0 flex-1 justify-start rounded-none px-5 py-4 text-start',
            c.state.id === item.id && 'bg-accent/10',
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
