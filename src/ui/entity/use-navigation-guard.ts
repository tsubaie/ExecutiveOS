'use client';
import { useEffect } from 'react';
import type { SaveState } from './types';
export function requestEntityNavigation(action: () => void) {
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement.closest('.entity-detail')
  )
    document.activeElement.blur();
  const invalid = document.querySelector<HTMLInputElement>('[data-autosave=true] input:invalid');
  if (invalid) {
    invalid.reportValidity();
    return;
  }
  if (
    window.dispatchEvent(new CustomEvent('entity:navigate', { cancelable: true, detail: action }))
  )
    action();
}
export function useNavigationGuard(
  navigate: (action: () => void) => Promise<void>,
  state: SaveState,
) {
  // sync: protect application navigation and browser unload while the active editor saves.
  useEffect(() => {
    const guarded = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'function') return;
      event.preventDefault();
      const action = event.detail;
      void navigate(() => action());
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (['saving', 'error', 'conflict'].includes(state)) event.preventDefault();
    };
    window.addEventListener('entity:navigate', guarded);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('entity:navigate', guarded);
      window.removeEventListener('beforeunload', unload);
    };
  }, [navigate, state]);
}
