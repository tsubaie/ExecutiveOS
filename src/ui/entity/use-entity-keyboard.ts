'use client';
import { useEffect, type RefObject } from 'react';
import type { Entity } from './types';
type Options = {
  items: Entity[];
  focused: number;
  setFocused: (index: number) => void;
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void;
  close: () => void;
  panel: boolean;
  selected: string[];
  selectable: boolean;
  select: () => void;
  clear: () => void;
};
export function useEntityKeyboard(root: RefObject<HTMLElement | null>, options: Options) {
  // sync: delegated DOM keyboard events belong to the entity surface, not individual modules.
  useEffect(() => {
    const element = root.current;
    function keyboard(event: KeyboardEvent) {
      if (ignoredKey(event)) return;
      if (!options.panel && ['ArrowDown', 'j', 'ArrowUp', 'k'].includes(event.key)) {
        event.preventDefault();
        focusNeighbor(event, options, element);
      }
      if (!options.panel && event.key === 'x') {
        event.preventDefault();
        selectFocused(options);
      }
      if (event.key === 'n') {
        event.preventDefault();
        options.navigate({ new: '1' });
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (options.panel) options.close();
        else options.clear();
      }
    }
    element?.addEventListener('keydown', keyboard);
    return () => element?.removeEventListener('keydown', keyboard);
  }, [root, options]);
}

function ignoredKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true;
  return (
    event.target instanceof HTMLElement &&
    Boolean(event.target.closest('input,textarea,select,[contenteditable=true],[role=dialog]'))
  );
}

function selectFocused(options: Options) {
  const item = options.items[options.focused];
  if (!item || !options.selectable) return;
  options.select();
  const selected = options.selected.includes(item.id)
    ? options.selected.filter((id) => id !== item.id)
    : [...options.selected, item.id];
  options.navigate({ sel: selected.join(',') }, true);
}

function focusNeighbor(event: KeyboardEvent, options: Options, element: HTMLElement | null) {
  const index = Math.max(
    0,
    Math.min(
      options.items.length - 1,
      options.focused + (['ArrowDown', 'j'].includes(event.key) ? 1 : -1),
    ),
  );
  options.setFocused(index);
  const item = options.items[index];
  if (item)
    element?.querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(item.id)}"]`)?.focus();
}
