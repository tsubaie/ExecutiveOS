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
    if (!options.panel) {
      const step = arrowStep(event, root.current);
      if (step) {
        event.preventDefault();
        focusNeighbor(step, options, root.current);
      }
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
  // EP-B06: opening a record takes focus off the row before the panel exists to receive it, so
  // for a short stretch while the record loads focus sits on the document body, outside this
  // surface, where a delegated listener never sees the key and Escape did nothing. Escape is the
  // one shortcut that has to survive that, so it is also handled from the document, and only
  // under the two conditions that describe the gap: this surface has a panel open, and focus is
  // nowhere at all. Anything focused inside the surface still goes through the listener below.
  const escapeFromNowhere = useEffectEvent(() => {
    if (options.panel) options.close();
  });
  // Capture phase, so a picker trigger that stops propagation of Escape cannot hide it.
  // sync: delegated DOM keyboard events belong to the entity surface, not individual modules.
  useEffect(() => {
    const element = root.current;
    const listener = (event: KeyboardEvent) => keyboard(event);
    element?.addEventListener('keydown', listener, true);
    return () => element?.removeEventListener('keydown', listener, true);
  }, [root]);
  // sync: DOM keyboard events that no element inside the surface can receive.
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.activeElement !== document.body) return;
      event.preventDefault();
      escapeFromNowhere();
    };
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);
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

// EP-B06 moved focus along one axis, which is the whole list when rows are lines. A grid has two
// (EP-B27): down is a whole track row away, not the next item. The track count is read off the
// list's computed columns rather than passed down, because it is the container query that decides
// it and nothing in React knows the answer. Left and right are bound only in a grid, so on a list
// of lines those keys stay with the browser; in RTL they swap, since the next tile sits at the
// start edge (EP-B09). Returns 0 for a key this surface does not handle.
function arrowStep(event: KeyboardEvent, element: HTMLElement | null) {
  const rows = element?.querySelector('[data-entity-rows]');
  const style = rows ? getComputedStyle(rows) : null;
  const columns = style ? style.gridTemplateColumns.split(' ').filter(Boolean).length : 1;
  if (['ArrowDown', 'j'].includes(event.key)) return columns;
  if (['ArrowUp', 'k'].includes(event.key)) return -columns;
  if (columns < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return 0;
  return (style?.direction === 'rtl') === (event.key === 'ArrowLeft') ? 1 : -1;
}

function focusNeighbor(step: number, options: Options, element: HTMLElement | null) {
  const index = Math.max(0, Math.min(options.items.length - 1, options.focused + step));
  options.setFocused(index);
  const item = options.items[index];
  if (item)
    element?.querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(item.id)}"]`)?.focus();
}
