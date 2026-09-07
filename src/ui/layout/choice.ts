import type { ReactNode } from 'react';
// One choice from a fixed list. `label` is what the user sees (it may carry an icon or a dot);
// `text` is the plain wording used for search and screen readers.
export type Choice<V extends string = string> = { value: V; label: ReactNode; text: string };
export type ChoiceSelectProps<V extends string> = {
  items: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
  name?: string;
  size?: 'sm' | 'default';
  disabled?: boolean;
};
