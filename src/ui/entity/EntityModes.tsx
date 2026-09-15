'use client';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Table2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import type { Entity } from './types';
import type { Surface } from './surface';
// The two toolbar controls that change how the list is read rather than what is in it: the
// presentation it is drawn in (EP-B29) and the reading every row is taken under (EP-B28). Neither
// removes a record, which is why neither lives in the filter sheet.
export function EntityModes<T extends Entity, P extends object, C>(props: Surface<T, P, C>) {
  return (
    <>
      <EntityLayout {...props} />
      <EntityMode {...props} />
    </>
  );
}
// EP-B29: card or table, offered only where the module has declared columns to put in one. Icons
// alone: the two arrangements are the thing being chosen, and a picture of each says it faster than
// its name in any language. Both carry their label to assistive technology.
function EntityLayout<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const t = useTranslations('common');
  if (!config.renderers.columns?.length) return null;
  const options = [
    { id: '', label: t('layoutCards'), Icon: LayoutGrid },
    { id: 'table', label: t('layoutTable'), Icon: Table2 },
  ];
  // EP-B29: the choice is offered where a table can actually be read. On a 390 px phone it cannot,
  // and a control that hands the reader an unusable arrangement is worse than one that never asked.
  return (
    <div
      role="group"
      aria-label={t('layout')}
      className="hidden shrink-0 rounded-lg border p-0.5 @lg:flex"
    >
      {options.map((option) => (
        <Button
          key={option.id}
          variant="ghost"
          size="sm"
          aria-label={option.label}
          aria-pressed={option.id === c.state.layout}
          className={cn(
            'h-7 px-2 text-text-muted',
            option.id === c.state.layout && 'bg-surface-raised text-text',
          )}
          onClick={() => c.setLayout(option.id)}
        >
          <option.Icon className="size-4" aria-hidden={true} />
        </Button>
      ))}
    </div>
  );
}

// EP-B28: the reading the whole list is taken under. A segmented group rather than a select,
// because the options are few, fixed and compared against each other — and because the record's
// own period toggle is this shape, so moving between the list and a record does not change how the
// same question is asked. It is not folded into the filter sheet: a filter shortens the list and
// this does not, and something that rewrites every figure on the page should not be behind a
// button that says how many filters are on.
function EntityMode<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const mode = config.filters.mode;
  if (!mode) return null;
  const current = c.facets[mode.key] ?? '';
  return (
    <div role="group" aria-label={mode.label} className="flex shrink-0 rounded-lg border p-0.5">
      {mode.options.map((option) => (
        <Button
          key={option.id}
          variant="ghost"
          size="sm"
          aria-pressed={option.id === current}
          className={cn(
            'h-7 px-2.5 text-xs font-normal text-text-muted',
            option.id === current && 'bg-surface-raised font-medium text-text',
          )}
          onClick={() => c.navigate({ [mode.key]: option.id, id: null, sel: null }, true)}
        >
          <span className="segmented-label" data-label={option.label}>
            {option.label}
          </span>
        </Button>
      ))}
    </div>
  );
}
