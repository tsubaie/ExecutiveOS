import type { SortOption } from './types';
// Sort declarations share one shape: the module's `default` sort is the empty URL value, every
// other allowed sort keeps its id, and each is labelled through the module's own catalog.
export function sortOptions<V extends string>(values: readonly V[], label: (value: V) => string) {
  const options: SortOption[] = values.map((value) => ({
    id: value === 'default' ? '' : value,
    label: label(value),
  }));
  return { default: '', options };
}
