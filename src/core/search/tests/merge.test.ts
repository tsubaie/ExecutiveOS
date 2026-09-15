import { it, expect } from 'vitest';
import { mergeHits, likePattern, prefixPattern } from '../merge';
import type { SearchHit } from '../types';
const hit = (module: string, n: number, rank: 0 | 1 = 1): SearchHit => ({
  module,
  id: `${module}-${n}`,
  title: `${module} ${n}`,
  href: `/${module}`,
  rank,
});
it('SEARCH-B03 interleaves modules so no one of them fills the palette', () => {
  const merged = mergeHits(
    [
      [hit('tasks', 1), hit('tasks', 2), hit('tasks', 3)],
      [hit('notes', 1)],
      [hit('people', 1), hit('people', 2)],
    ],
    20,
  );
  expect(merged.map((item) => item.id)).toEqual([
    'tasks-1',
    'notes-1',
    'people-1',
    'tasks-2',
    'people-2',
    'tasks-3',
  ]);
});
it('SEARCH-B03 puts a title the query starts before a match anywhere, within one module', () => {
  const merged = mergeHits([[hit('tasks', 1, 1), hit('tasks', 2, 0)]], 20);
  expect(merged.map((item) => item.id)).toEqual(['tasks-2', 'tasks-1']);
});
it('SEARCH-B03 truncates at the total limit and stops when every module is spent', () => {
  const many = Array.from({ length: 5 }, (_, index) => hit('tasks', index));
  expect(mergeHits([many, many], 3)).toHaveLength(3);
  expect(mergeHits([[hit('tasks', 1)], []], 20)).toHaveLength(1);
  expect(mergeHits([], 20)).toEqual([]);
});
it('SEARCH-B01 escapes wildcards so a query of 100% searches for those characters', () => {
  expect(likePattern('100%')).toBe('%100\\%%');
  expect(likePattern('a_b')).toBe('%a\\_b%');
  // The escape character itself has to be escaped, or a trailing backslash breaks the pattern.
  expect(likePattern('c:\\')).toBe('%c:\\\\%');
  expect(prefixPattern('100%')).toBe('100\\%%');
});
