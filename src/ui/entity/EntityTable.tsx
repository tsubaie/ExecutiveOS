'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Column, Entity } from './types';
import type { Surface } from './EntityControls';
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
function leadingCells<T extends Entity, P extends object, C>(
  config: Surface<T, P, C>['config'],
  c: Surface<T, P, C>['controller'],
) {
  return (config.bulkActions?.length && c.selecting ? 1 : 0) + (config.rowAction ? 1 : 0);
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
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{config.title}</caption>
        <thead>
          <tr className="border-b">
            {selectable && <th scope="col" className="w-11" />}
            {config.rowAction && <th scope="col" className="w-11" />}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-3 py-2 text-xs font-medium whitespace-nowrap text-text-muted',
                  column.numeric ? 'text-end' : 'text-start',
                )}
              >
                {column.head}
              </th>
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
      <EntityTableHeading config={config} controller={c} rows={rows} index={index} />
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
            <th key={column.key} scope="row" className="max-w-xs px-3 py-2 text-start font-normal">
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
  const toggle = (checked: boolean) =>
    c.navigate(
      {
        sel: (checked
          ? [...c.selected, item.id]
          : c.selected.filter((id) => id !== item.id)
        ).join(','),
      },
      true,
    );
  return (
    <>
      {config.bulkActions?.length && c.selecting ? (
        <td className="relative z-10 w-11 ps-1">
          <Checkbox
            className="entity-check"
            aria-label={t('selectItem', { name: config.renderers.name(item) })}
            checked={c.selected.includes(item.id)}
            onCheckedChange={toggle}
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
// EP-B14 in a table: the heading is a row of its own spanning every column, so the grouping is
// part of the table rather than a block floating between two of them.
function EntityTableHeading<T extends Entity, P extends object, C>({
  config,
  controller: c,
  rows,
  index,
}: Surface<T, P, C> & { rows: Rendered<T>[]; index: number }) {
  const count = useCount();
  const item = rows[index]?.item;
  const before = rows[index - 1]?.item;
  const heading = item && !c.state.sort ? config.group?.(item) : null;
  if (!heading || (before && heading === config.group?.(before))) return null;
  const size = rows.filter((row) => !row.leaving && config.group?.(row.item) === heading).length;
  return (
    <tr>
      <th
        scope="colgroup"
        colSpan={leadingCells(config, c) + (config.renderers.columns?.length ?? 0)}
        className="border-b bg-surface-raised/60 px-3 py-1.5 text-start text-[11px] font-semibold tracking-wider text-text-muted uppercase"
      >
        {heading}
        <span className="ms-2 text-[10px] tabular-nums">{count(size)}</span>
      </th>
    </tr>
  );
}
