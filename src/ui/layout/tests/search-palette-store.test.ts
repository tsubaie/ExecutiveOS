// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  closeSearchPalette,
  openSearchPalette,
  setSearchScope,
  useSearchPalette,
} from '../search-palette-store';
afterEach(() => {
  act(() => {
    closeSearchPalette();
    setSearchScope(null);
  });
});
it('SEARCH-B12 a list on screen registers a scope the palette can hand a query to, and withdraws it', () => {
  const search = vi.fn();
  const { result } = renderHook(() => useSearchPalette());
  expect(result.current.scope).toBeNull();
  act(() => setSearchScope({ label: 'Tasks', search }));
  expect(result.current.scope?.label).toBe('Tasks');
  result.current.scope?.search('budget');
  expect(search).toHaveBeenCalledWith('budget');
  act(() => setSearchScope(null));
  expect(result.current.scope).toBeNull();
});
it('EP-B41 opening the palette from a list carries the phrase it could not find, and closing drops it', () => {
  const { result } = renderHook(() => useSearchPalette());
  expect(result.current).toMatchObject({ open: false, query: '' });
  act(() => openSearchPalette('budget'));
  expect(result.current).toMatchObject({ open: true, query: 'budget' });
  act(() => closeSearchPalette());
  expect(result.current).toMatchObject({ open: false, query: '' });
  act(() => openSearchPalette());
  expect(result.current).toMatchObject({ open: true, query: '' });
});
