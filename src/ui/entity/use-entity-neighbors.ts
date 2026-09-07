'use client';
import { useEffect, useRef } from 'react';
import type { Entity, ListResult } from './types';
export function useEntityNeighbors<T extends Entity>(
  list: ListResult<T>,
  id: string | null,
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void,
) {
  const waiting = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  const index = list.items.findIndex((item) => item.id === id);
  // sync: restore DOM focus after the mobile list is visible and advance after pagination arrives.
  useEffect(() => {
    if (!id && last.current)
      document
        .querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(last.current)}"]`)
        ?.focus({ preventScroll: true });
    last.current = id;
    if (waiting.current !== id) {
      waiting.current = null;
      return;
    }
    const next = list.items[index + 1];
    if (next && id) {
      waiting.current = null;
      navigate({ id: next.id }, true);
    }
  }, [id, index, list.items, navigate]);
  return {
    previous: index > 0,
    next: index >= 0 && (index < list.items.length - 1 || list.more),
    position: index + 1,
    count: list.items.length,
    move: (direction: number) => {
      const next = list.items[index + direction];
      if (index >= 0 && next) navigate({ id: next.id }, true);
      else if (direction > 0 && list.more) {
        waiting.current = id;
        void list.fetchMore();
      }
    },
  };
}
