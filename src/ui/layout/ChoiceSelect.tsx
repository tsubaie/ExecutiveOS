'use client';
import { Suspense, lazy } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/primitives/select';
import type { ChoiceSelectProps } from './choice';
export type { Choice, ChoiceSelectProps } from './choice';
// Lists up to ten options open as a plain menu; longer lists get a search box at the top
// (docs/05 § Design system). Either way a hidden input carries `name` into plain form posts.
export const SEARCH_THRESHOLD = 10;
const SearchableChoice = lazy(() => import('./SearchableChoice'));
export function ChoiceSelect<V extends string>(props: ChoiceSelectProps<V>) {
  if (props.items.length <= SEARCH_THRESHOLD) return <PlainChoice {...props} />;
  // The lazy module works in plain strings; the lookup hands back the typed value.
  const change = (next: string) => {
    const hit = props.items.find((item) => item.value === next);
    if (hit) props.onChange(hit.value);
  };
  return (
    <Suspense fallback={<PlainChoice {...props} disabled />}>
      <SearchableChoice {...props} onChange={change} />
    </Suspense>
  );
}
function PlainChoice<V extends string>({
  items,
  value,
  onChange,
  label,
  name,
  size,
  disabled,
}: ChoiceSelectProps<V>) {
  return (
    <Select
      items={items}
      value={value}
      name={name}
      disabled={disabled}
      onValueChange={(next) => next !== null && next !== value && onChange(next)}
    >
      <SelectTrigger size={size ?? 'default'} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} label={item.text}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
