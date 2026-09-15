'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './surface';
import { EntityGroupHeading, selectRow } from './rows';
import { useRowMotion, rowMotionClass, type Rendered } from './use-row-motion';
import { EntityTable } from './EntityTable';
import { EntityListSkeleton, EntityEmpty } from './EntityStates';
export function EntityList<T extends Entity, P extends object, C>(props: Surface<T, P, C>) {
  const t = useTranslations('common');
  const { list } = props.controller;
  const rows = useRowMotion(list.items, list.pending);
  if (list.pending) return <EntityListSkeleton />;
  if (list.error) return <ErrorPanel error={list.error} retry={list.refetch} />;
  if (!rows.length) return <EntityEmpty {...props} />;
  // EP-B29: the table is the same records, the same selection and the same keyboard; only the
  // arrangement differs, so it branches here rather than anywhere the rest of the surface can see.
  if (props.controller.state.layout === 'table' && props.config.renderers.columns?.length)
    return (
      <>
        <EntityTable {...props} rows={rows} />
        {list.more && (
          <Button variant="ghost" className="m-4" onClick={() => void list.fetchMore()}>
            {t('more')}
          </Button>
        )}
      </>
    );
  return (
    <>
      {/* EP-B27: the grid is declared on the list itself and its column count comes from container
          queries, so it answers to the width the list actually has rather than to the window's.
          `data-entity-rows` is how the keyboard finds the track count without being told it. */}
      <ul
        data-entity-rows
        className={cn(
          props.config.renderers.rowStyle === 'grid' &&
            'entity-grid grid items-stretch gap-3 p-3 @2xl:grid-cols-2 @5xl:grid-cols-3',
        )}
      >
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
function EntityListRow<T extends Entity, P extends object, C>({
  config,
  controller: c,
  rows,
  row,
  index,
}: Surface<T, P, C> & { rows: Rendered<T>[]; row: Rendered<T>; index: number }) {
  const { item, leaving } = row;
  const current = !leaving && c.state.id === item.id;
  const shape = rowShape(config.renderers.rowStyle, Boolean(config.rowAction) || c.selecting);
  return (
    <>
      <EntityGroupHeading config={config} controller={c} rows={rows} index={index} />
      <li className={cn(rowMotionClass(row), 'min-w-0')} inert={leaving || undefined}>
        <div
          className={cn(
            'entity-row relative flex min-w-0 items-center transition-colors',
            shape.shell,
            current ? 'bg-accent-soft' : 'hover:bg-surface-raised/50',
          )}
          data-current={current ? '' : undefined}
        >
          <EntityRowLead config={config} controller={c} item={item} />
          <Button
            data-row-id={leaving ? undefined : item.id}
            aria-current={current ? 'true' : undefined}
            variant="ghost"
            className={shape.button}
            onFocus={() => c.setFocused(index)}
            onClick={() => c.navigate({ id: item.id })}
          >
            {config.renderers.row(item)}
          </Button>
          <EntityRowTrail config={config} controller={c} item={item} />
        </div>
      </li>
    </>
  );
}
// The three presentations of one row, kept together so the differences between them are readable
// side by side rather than spread across four conditional class lists. A card is a full-width
// container, a tile fills its grid cell so a short record and a long one line up across a track
// row (EP-B27), and the default is a bordered line.
const SURFACE =
  'overflow-hidden rounded-xl border border-border/60 bg-surface-raised/30 hover:border-accent/40';
function rowShape(style: 'card' | 'grid' | undefined, lead: boolean) {
  const button =
    'h-auto min-h-11 min-w-0 flex-1 justify-start rounded-none px-3 py-1.5 text-start hover:bg-transparent';
  if (style === 'grid')
    return {
      shell: cn('h-full items-stretch', SURFACE),
      button: cn(button, 'items-stretch rounded-xl p-4 whitespace-normal'),
    };
  if (style === 'card')
    return {
      shell: cn('mx-3 mb-2 flex-wrap @lg:flex-nowrap', SURFACE),
      button: cn(button, 'min-h-14 basis-3/4 rounded-lg px-4 py-3 @lg:basis-0'),
    };
  return { shell: 'border-b', button: cn(button, !lead && 'ps-4') };
}

// EP-B20: the trailing slot mirrors the leading one. A control belongs here rather than in
// `renderers.row`, whose output is inside the row button and may not nest an interactive element.
function EntityRowTrail<T extends Entity, P extends object, C>({
  config,
  item,
}: Surface<T, P, C> & { item: T }) {
  if (!config.renderers.rowTrail) return null;
  const trail = config.renderers.rowTrail(item);
  if (!trail) return null;
  return (
    <div
      className={
        config.renderers.rowStyle === 'card'
          ? 'mx-4 mb-3 w-full @lg:ms-1 @lg:me-4 @lg:my-2 @lg:w-auto @lg:max-w-[45%] @lg:shrink-0'
          : 'me-3 shrink-0'
      }
    >
      {trail}
    </div>
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
          className={cn(
            'entity-check ms-1 shrink-0',
            config.renderers.rowStyle === 'card' && 'ms-3 self-center',
            // A tile has no leading column to give the control, so it sits over the tile's own
            // corner rather than pushing the figures across.
            config.renderers.rowStyle === 'grid' && 'absolute top-1 start-1 z-10 ms-0',
          )}
          aria-label={t('selectItem', { name: config.renderers.name(item) })}
          checked={c.selected.includes(item.id)}
          onCheckedChange={(checked) => selectRow(c, item.id, checked)}
        />
      ) : null}
      {config.rowAction && !c.selecting && (
        <div
          className={cn(
            'ms-1 shrink-0',
            config.renderers.rowStyle === 'card' && 'ms-3 flex items-center',
          )}
        >
          {config.rowAction(item)}
        </div>
      )}
    </>
  );
}
