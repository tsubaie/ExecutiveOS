// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityNeighbors } from '../use-entity-neighbors';
import type { Entity, ListResult } from '../types';
it('EP-B13 next at a loaded-page boundary waits for the next page then opens its first row', async () => {
  const first: Entity = { id: 'first', revision: 1, deletedAt: null, deletedOpId: null };
  const second: Entity = { ...first, id: 'second' };
  const fetchMore = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn();
  const initial: ListResult<Entity> = {
    items: [first],
    counts: {},
    pending: false,
    error: null,
    more: true,
    fetchMore,
    refetch: vi.fn(),
  };
  const { result, rerender } = renderHook(
    ({ list }) => useEntityNeighbors(list, first.id, navigate),
    { initialProps: { list: initial } },
  );
  await act(async () => result.current.move(1));
  expect(fetchMore).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  rerender({ list: { ...initial, items: [first, second], more: false } });
  expect(navigate).toHaveBeenCalledWith({ id: second.id }, true);
});
