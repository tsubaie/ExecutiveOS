// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRowMotion, rowMotionClass } from '../use-row-motion';
type Row = { id: string; revision: number; deletedAt: null; deletedOpId: null };
const row = (id: string): Row => ({ id, revision: 1, deletedAt: null, deletedOpId: null });
const rows = (...ids: string[]) => ids.map(row);
const ids = (rendered: { item: Row; entering: boolean; leaving: boolean }[], key: 'entering' | 'leaving') =>
  rendered.filter((entry) => entry[key]).map((entry) => entry.item.id);
afterEach(() => vi.useRealTimers());
it('EP-B12 a row created into a list already on screen arrives, and the entrance ends', () => {
  vi.useFakeTimers();
  const view = renderHook(({ items }) => useRowMotion(items, false), {
    initialProps: { items: rows('a', 'b') },
  });
  // Nothing animates on the first render: the list arriving is not a row arriving.
  expect(ids(view.result.current, 'entering')).toEqual([]);
  view.rerender({ items: rows('a', 'new', 'b') });
  expect(ids(view.result.current, 'entering')).toEqual(['new']);
  act(() => vi.advanceTimersByTime(400));
  expect(ids(view.result.current, 'entering')).toEqual([]);
});
it('EP-B12 a row that leaves stays rendered for its exit, in the place it held', () => {
  vi.useFakeTimers();
  const view = renderHook(({ items }) => useRowMotion(items, false), {
    initialProps: { items: rows('a', 'b', 'c') },
  });
  view.rerender({ items: rows('a', 'c') });
  expect(view.result.current.map((entry) => entry.item.id)).toEqual(['a', 'b', 'c']);
  expect(ids(view.result.current, 'leaving')).toEqual(['b']);
  act(() => vi.advanceTimersByTime(400));
  expect(view.result.current.map((entry) => entry.item.id)).toEqual(['a', 'c']);
});
it('EP-B12 a whole different list is a new screen, not a set of arrivals', () => {
  vi.useFakeTimers();
  const view = renderHook(({ items }) => useRowMotion(items, false), {
    initialProps: { items: rows('a', 'b') },
  });
  // A view or filter change replaces every row at once; animating that is a page flashing.
  view.rerender({ items: rows('x', 'y') });
  expect(ids(view.result.current, 'entering')).toEqual([]);
  expect(ids(view.result.current, 'leaving')).toEqual([]);
});
it('EP-B12 more rows than one event arrive without animating', () => {
  vi.useFakeTimers();
  const view = renderHook(({ items }) => useRowMotion(items, false), {
    initialProps: { items: rows('a') },
  });
  view.rerender({ items: rows('a', 'p', 'q', 'r', 's') });
  expect(ids(view.result.current, 'entering')).toEqual([]);
});
it('EP-B12 a list that was loading arrives as a list, not as a cascade of rows', () => {
  vi.useFakeTimers();
  const view = renderHook(({ items, pending }) => useRowMotion(items, pending), {
    initialProps: { items: [] as Row[], pending: true },
  });
  view.rerender({ items: rows('a', 'b', 'c'), pending: false });
  expect(ids(view.result.current, 'entering')).toEqual([]);
});
it('EP-B12 a row takes one class or the other, never both', () => {
  expect(rowMotionClass({ leaving: true, entering: false })).toBe('entity-row-leaving');
  expect(rowMotionClass({ leaving: false, entering: true })).toBe('entity-row-entering');
  expect(rowMotionClass({ leaving: false, entering: false })).toBeUndefined();
  // Leaving wins: a row cannot be introduced and withdrawn in the same frame.
  expect(rowMotionClass({ leaving: true, entering: true })).toBe('entity-row-leaving');
});
