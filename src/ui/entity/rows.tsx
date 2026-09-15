import { useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './surface';
import type { Rendered } from './use-row-motion';
// The two things every arrangement of rows has to work out for itself, kept in one place so a list
// and a table cannot drift apart on either: what selecting a row does to the URL, and whether this
// row is the one that opens a group.
export function selectRow<T extends Entity, P extends object, C>(
  c: Surface<T, P, C>['controller'],
  id: string,
  checked: boolean,
) {
  const selected = checked ? [...c.selected, id] : c.selected.filter((entry) => entry !== id);
  c.navigate({ sel: selected.join(',') }, true);
}
// EP-B14: a heading only means something while the list is in the order the grouping describes.
// Once the reader has chosen a sort of their own the rows no longer arrive grouped and the headings
// would repeat down the page marking nothing, so a sort suppresses them outright. The count is of
// the rows loaded under this heading, and a row on its way out is not one of them.
export function groupAt<T extends Entity, P extends object, C>(
  { config, controller: c }: Surface<T, P, C>,
  rows: Rendered<T>[],
  index: number,
) {
  const item = rows[index]?.item;
  const before = rows[index - 1]?.item;
  const heading = item && !c.state.sort ? config.group?.(item) : null;
  if (!heading || (before && heading === config.group?.(before))) return null;
  return {
    heading,
    size: rows.filter((row) => !row.leaving && config.group?.(row.item) === heading).length,
  };
}

// How many cells stand before the first column of a table: the selection box and the row action,
// each only while it is showing.
export function leadingCells<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  return (config.bulkActions?.length && c.selecting ? 1 : 0) + (config.rowAction ? 1 : 0);
}
// EP-B14: one heading, in whichever shape the rows around it are taking. A table's has to be a row
// spanning every column or the grouping sits outside the table it groups; a grid's has to span
// every track; and either way it is a sibling of the rows rather than a block inside the first of
// them, so a row fading out never takes its heading with it.
export function EntityGroupHeading<T extends Entity, P extends object, C>(
  surface: Surface<T, P, C> & { rows: Rendered<T>[]; index: number },
) {
  const { config, controller: c, rows, index } = surface;
  const count = useCount();
  const group = groupAt(surface, rows, index);
  if (!group) return null;
  const badge = <span className="text-[10px] tabular-nums">{count(group.size)}</span>;
  if (c.state.layout === 'table' && config.renderers.columns?.length)
    return (
      <tr>
        <th
          scope="colgroup"
          colSpan={leadingCells(surface) + (config.renderers.columns?.length ?? 0)}
          className="border-b bg-surface-raised/60 px-3 py-1.5 text-start text-[11px] font-semibold tracking-wider text-text-muted uppercase"
        >
          {group.heading}
          <span className="ms-2 text-[10px] tabular-nums">{count(group.size)}</span>
        </th>
      </tr>
    );
  if (config.renderers.rowStyle === 'grid')
    return (
      <li className="col-span-full flex items-center gap-2 pt-2 text-xs font-medium text-text-muted">
        <h2>{group.heading}</h2>
        {badge}
      </li>
    );
  if (config.renderers.rowStyle === 'card')
    return (
      <li>
        <h2 className="flex items-center gap-2 px-4 pt-5 pb-2 text-xs font-medium text-text-muted">
          {group.heading}
          {badge}
        </h2>
      </li>
    );
  return (
    <li>
      <h2 className="flex h-7 items-center gap-2 border-b bg-surface-raised/60 px-4 text-[11px] leading-none font-semibold tracking-wider text-text-muted uppercase">
        {group.heading}
        <span className={cn('rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px]',
          'font-semibold tracking-normal text-text tabular-nums')}>
          {count(group.size)}
        </span>
      </h2>
    </li>
  );
}
