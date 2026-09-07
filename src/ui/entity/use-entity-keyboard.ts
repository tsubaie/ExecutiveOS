'use client';
import { useEffect, useEffectEvent, type RefObject } from 'react';
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
  openBulk: () => void;
};
export function useEntityKeyboard(root: RefObject<HTMLElement | null>, options: Options) {
  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (ignoredKey(event)) return;
    if (!options.panel && ['ArrowDown', 'j', 'ArrowUp', 'k'].includes(event.key)) {
      event.preventDefault();
      focusNeighbor(event, options, root.current);
    }
    if (!options.panel && event.key === 'x') {
      event.preventDefault();
      selectFocused(options);
    }
    if (!options.panel && event.key === 'a' && options.selected.length) {
      event.preventDefault();
      options.openBulk();
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
  });
  // Capture phase, so a picker trigger that stops propagation of Escape cannot hide it.
  // sync: delegated DOM keyboard events belong to the entity surface, not individual modules.
  useEffect(() => {
    const element = root.current;
    const listener = (event: KeyboardEvent) => keyboard(event);
    element?.addEventListener('keydown', listener, true);
    return () => element?.removeEventListener('keydown', listener, true);
  }, [root]);
}

// Shortcuts stay out of fields and dialogs, except Escape: from a field or a closed picker it
// closes the panel once pending saves settle (EP-B06, EP-B11). Open pickers render in a portal
// outside the surface, so their own Escape never reaches this listener.
function ignoredKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true;
  if (!(event.target instanceof HTMLElement)) return false;
  if (event.target.closest('[role=dialog]')) return true;
  if (event.key === 'Escape') return event.target.getAttribute('aria-expanded') === 'true';
  return Boolean(
    event.target.closest('input,textarea,select,[contenteditable=true],[role=combobox]'),
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
