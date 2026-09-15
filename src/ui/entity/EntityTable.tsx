'use client';
import { useTranslations } from 'next-intl';
import { ArrowDownUp } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { cn } from '@/ui/cn';
import type { Column, Entity } from './types';
import type { Surface } from './surface';
import { EntityGroupHeading, selectRow } from './rows';
import { rowMotionClass, type Rendered } from './use-row-motion';
// EP-B29: the same records as a table, for reading down a column rather than across a row. It is a
// real table — a caption, a header row, one row header per record — because that is what lets a
// screen reader say which column a cell belongs to, and no arrangement of divs earns that back.
//
// The whole row opens the record, but only one thing in it is focusable: the control in the row
// header, stretched over the row by a pseudo-element. A row of nested buttons would be a row the
// keyboard has to walk through cell by cell to get past, and every cell would need its own name.
// Controls that belong to the record rather than to opening it — the selection box — sit above
// that overlay and keep their own hit area.
//
// The table keeps its own horizontal scroll (docs/05): columns hold their widths, so an open
// record covers the end of the table rather than reflowing it, which is the whole point of the
// slide-over it sits under (EP-B26).
// The columns are declared, not measured. Measured widths came from the content and moved whenever
// anything forced a relayout, so a column could change width for reasons that had nothing to do
// with what was in it. Nothing the reader does should move a column.
//
// The widths are absolute rather than percentages for the same reason: a percentage on a `col`
// resolves against a base that is not the table's own box, and the same declaration measured 32 %
// of two different numbers depending on whether a record was open. Lengths cannot drift like that,
// and `table-layout: fixed` shares out whatever is left over them in proportion.
function EntityColumns<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  return (
    <colgroup>
      {Boolean(config.bulkActions?.length) && c.selecting && <col className="w-11" />}
      {config.rowAction && <col className="w-11" />}
      {(config.renderers.columns ?? []).map((column) => (
        <col
          key={column.key}
          className={cn(column.primary ? 'w-[22rem]' : column.numeric ? 'w-[7rem]' : 'w-[10rem]')}
        />
      ))}
    </colgroup>
  );
}
export function EntityTable<T extends Entity, P extends object, C>({
  config,
  controller: c,
  rows,
}: Surface<T, P, C> & { rows: Rendered<T>[] }) {
  const columns = config.renderers.columns ?? [];
  const selectable = Boolean(config.bulkActions?.length) && c.selecting;
  return (
    <div className="w-full overflow-x-auto">
      {/* Fixed layout, not auto: a data table wants columns that hold still (see EntityColumns).
          The table fills its container and keeps a floor, so the columns cannot be squeezed into
          unreadability and the container scrolls once they reach it. */}
      <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{config.title}</caption>
        <EntityColumns config={config} controller={c} />
        <thead>
          <tr className="border-b">
            {selectable && <th scope="col" className="w-11" />}
            {config.rowAction && <th scope="col" className="w-11" />}
            {columns.map((column) => (
              <EntityColumnHead key={column.key} column={column} config={config} controller={c} />
            ))}
          </tr>
        </thead>
        <tbody data-entity-rows>
          {rows.map((row, index) => (
            <EntityTableRow
              key={row.item.id}
              config={config}
              controller={c}
              rows={rows}
              row={row}
              index={index}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
// EP-B31: a column that maps to one of the module's sorts orders by it from its own header, which
// is the thing a table is expected to do and the dropdown could never be — its options are named
// orderings ("Needs attention first"), not the columns in front of the reader. Pressing the column
// already ordering by returns to the module's default, so the control is its own undo.
//
// `aria-sort` says `other` rather than ascending or descending on purpose: these are named orders
// owned by the module, and some of them (severity, then name) have no single direction to claim.
function EntityColumnHead<T extends Entity, P extends object, C>({
  column,
  controller: c,
}: Surface<T, P, C> & { column: Column<T> }) {
  const active = Boolean(column.sort) && c.state.sort === column.sort;
  const head = cn(
    'truncate px-3 py-2 text-xs font-medium whitespace-nowrap text-text-muted',
    column.numeric ? 'text-end' : 'text-start',
  );
  if (!column.sort)
    return (
      <th scope="col" className={head}>
        {column.head}
      </th>
    );
  return (
    <th scope="col" aria-sort={active ? 'other' : 'none'} className={cn(head, 'p-0')}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-auto w-full min-w-0 rounded-none px-3 py-2 text-xs font-medium text-text-muted',
          column.numeric ? 'justify-end' : 'justify-start',
          active && 'text-text',
        )}
        onClick={() => c.navigate({ sort: active ? null : (column.sort ?? null) }, true)}
      >
        <span className="truncate">{column.head}</span>
        <ArrowDownUp className={cn('size-3 shrink-0', !active && 'opacity-0')} aria-hidden={true} />
      </Button>
    </th>
  );
}
function EntityTableRow<T extends Entity, P extends object, C>({
  config,
  controller: c,
  rows,
  row,
  index,
}: Surface<T, P, C> & { rows: Rendered<T>[]; row: Rendered<T>; index: number }) {
  const { item, leaving } = row;
  const current = !leaving && c.state.id === item.id;
  const columns = config.renderers.columns ?? [];
  return (
    <>
      <EntityGroupHeading config={config} controller={c} rows={rows} index={index} />
      <tr
        className={cn(
          'entity-row relative border-b transition-colors',
          rowMotionClass(row),
          current ? 'bg-accent-soft' : 'hover:bg-surface-raised/50',
        )}
        data-current={current ? '' : undefined}
        inert={leaving || undefined}
      >
        <EntityTableLead config={config} controller={c} item={item} />
        {columns.map((column) =>
          column.primary ? (
            <th key={column.key} scope="row" className="px-3 py-2 text-start font-normal">
              <Button
                data-row-id={leaving ? undefined : item.id}
                aria-current={current ? 'true' : undefined}
                variant="ghost"
                className="entity-table-open h-auto min-h-11 w-full min-w-0 justify-start rounded-none px-0 py-1 text-start whitespace-normal hover:bg-transparent"
                onFocus={() => c.setFocused(index)}
                onClick={() => c.navigate({ id: item.id })}
              >
                {column.cell(item)}
              </Button>
            </th>
          ) : (
            <EntityTableCell key={column.key} column={column} item={item} />
          ),
        )}
      </tr>
    </>
  );
}
function EntityTableLead<T extends Entity, P extends object, C>({
  config,
  controller: c,
  item,
}: Surface<T, P, C> & { item: T }) {
  const t = useTranslations('common');
  return (
    <>
      {config.bulkActions?.length && c.selecting ? (
        <td className="relative z-10 w-11 ps-1">
          <Checkbox
            className="entity-check"
            aria-label={t('selectItem', { name: config.renderers.name(item) })}
            checked={c.selected.includes(item.id)}
            onCheckedChange={(checked) => selectRow(c, item.id, checked)}
          />
        </td>
      ) : null}
      {config.rowAction && <td className="relative z-10 w-11 ps-1">{config.rowAction(item)}</td>}
    </>
  );
}
function EntityTableCell<T extends Entity>({ column, item }: { column: Column<T>; item: T }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle',
        column.numeric ? 'text-end tabular-nums' : 'text-start',
      )}
    >
      {column.cell(item)}
    </td>
  );
}
