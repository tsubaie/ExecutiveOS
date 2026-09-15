const filterKeys = ['view', 'q', 'sort'];
export function resolveUrlState(params: URLSearchParams) {
  return {
    creating: params.get('new') === '1',
    id: params.get('new') === '1' ? null : params.get('id'),
    view: params.get('view') ?? 'all',
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? '',
    layout: params.get('layout') ?? '',
  };
}
export function changeUrl(params: URLSearchParams, patch: Record<string, string | null>) {
  const result = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch))
    if (value === null || value === '') result.delete(key);
    else result.set(key, value);
  // A search begun before a module default arrives stays in the visible All view.
  if ('q' in patch && !result.has('view')) result.set('view', 'all');
  if (patch.new === '1') result.delete('id');
  if (patch.id) result.delete('new');
  if (filterKeys.some((key) => key in patch)) {
    result.delete('sel');
    if (!patch.id) result.delete('id');
    if (!patch.new) result.delete('new');
  }
  return result.toString();
}

// EP-B29: the layout is deliberately absent here. Clearing filters puts the reader back to the
// unfiltered list; it does not take away the presentation they chose to read it in.
export function clearEntityFilters(keys: string[]) {
  return Object.fromEntries([
    ...keys.map((key) => [key, null]),
    ['view', 'all'],
    ['q', null],
    ['sort', null],
    ['id', null],
    ['new', null],
    ['sel', null],
  ]);
}
