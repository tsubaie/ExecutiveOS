'use client';
import { useEffect, useEffectEvent, type RefObject } from 'react';
// EP-B43: from 1024 px the record is a slide-over in front of the page (EP-B26), and a press on
// the page's ground anywhere outside it closes it exactly as Esc does (EP-B06), through the same
// guarded close. A press on a control — a row, a view, a link, a button, a field — does only what
// that control does: a view change or a link already ends the record through its own guarded
// navigation, and two guarded navigations from one press would answer the guard's dialog twice.
// Popups that render in a portal (pickers, dialogs, toasts) and the panel itself are left alone.
// Below 1024 px the record is the full-screen view of EP-B08 and nothing is beside it to press.
const SLIDE_OVER = '(min-width: 1024px)';
const CONTROLS =
  'a, button, input, textarea, select, summary, label, [role=button], [role=combobox], [role=option], [role=menuitem], [role=tab], [role=checkbox], [role=radio], [role=switch]';
const LEFT_ALONE = `[data-row-id], [data-base-ui-portal], [role=dialog], [role=alertdialog], [role=alert], [role=status], ${CONTROLS}`;
export function usePointerAway(
  root: RefObject<HTMLElement | null>,
  options: { panel: boolean; close: () => void },
) {
  const press = useEffectEvent((event: PointerEvent) => {
    if (!options.panel || !pressedAway(root.current, event.target)) return;
    options.close();
  });
  // sync: pointer presses on the document, judged against the surface's DOM.
  useEffect(() => {
    if (!options.panel) return;
    const listener = (event: PointerEvent) => press(event);
    document.addEventListener('pointerdown', listener, true);
    return () => document.removeEventListener('pointerdown', listener, true);
  }, [options.panel]);
}
export function pressedAway(surface: HTMLElement | null, target: EventTarget | null) {
  if (!surface || !(target instanceof Element)) return false;
  if (typeof window.matchMedia !== 'function' || !window.matchMedia(SLIDE_OVER).matches)
    return false;
  const panel = surface.querySelector('aside.entity-detail');
  if (!panel || panel.contains(target)) return false;
  return !target.closest(LEFT_ALONE);
}
