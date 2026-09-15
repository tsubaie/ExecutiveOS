'use client';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import type { Entity } from './types';
import type { Surface } from './surface';
// The contents of the filter sheet: the module's facets, each a fixed-list choice over one URL key.
// EP-B33: the sheet narrows the list; it does not also carry the sort. A sort is a named ordering
// that lives in the bar and, in a table, on the column headers (EP-B31). A third copy of it behind
// a button labelled by how many filters are on was the copy nobody could find — and it labelled
// itself from the default option, so the row read "Due date bands" over a select saying the same.
export function EntityFacets<T extends Entity, P extends object, C>({
  config,
  controller: c,
}: Surface<T, P, C>) {
  const change = (patch: Record<string, string | null>) =>
    c.navigate({ ...patch, id: null, new: null, sel: null }, true);
  return (
    <div className="grid gap-3">
      {config.filters.facets?.map((filter) => (
        <FacetSelect
          key={filter.key}
          label={filter.label}
          value={c.facets[filter.key] ?? ''}
          options={filter.options}
          onChange={(value) => change({ [filter.key]: value })}
        />
      ))}
    </div>
  );
}
function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-sm text-text-muted">
      <span>{label}</span>
      <ChoiceSelect
        items={options.map((option) => ({ ...option, text: option.label }))}
        value={value}
        label={label}
        onChange={onChange}
      />
    </div>
  );
}
