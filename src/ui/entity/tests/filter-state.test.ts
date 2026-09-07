import { describe, expect, it } from 'vitest';
import { clearEntityFilters, changeUrl } from '../url-state';
describe('Entity filtering', () => {
  it('EP-B15 clear removes all module facets, search, selection and detail', () => {
    const query = new URLSearchParams('q=test&ownerId=person&priority=high&sort=title&sel=a&id=a');
    const next = new URLSearchParams(
      changeUrl(query, clearEntityFilters(['ownerId', 'priority', 'sort'])),
    );
    expect([...next.entries()]).toEqual([['view', 'all']]);
  });
  it('EP-B03 Show in All retains the deep link and clears every facet', () => {
    const query = new URLSearchParams('view=overdue&priority=high&id=a');
    const next = new URLSearchParams(
      changeUrl(query, { ...clearEntityFilters(['priority']), id: 'a' }),
    );
    expect(next.get('id')).toBe('a');
    expect(next.has('priority')).toBe(false);
  });
});
