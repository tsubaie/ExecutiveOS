'use client';
import { useSyncExternalStore } from 'react';
// The palette is opened from more than one place — the header control, the keyboard chord, and an
// entity list's no-matches state handing over the phrase it could not find (EP-B41) — and it can
// hand a phrase back to the list that is on screen (SEARCH-B12). That is one piece of shared client
// state, read through the primitive that exists for exactly that, so the header and the list never
// hold a reference to each other.
//
// `scope` is the entity list currently on screen: what it is called and how to hand it a query.
// It is registered by the entity controller while the list is mounted and cleared when it leaves.
export type SearchScope = { label: string; search: (query: string) => void };
type PaletteState = { open: boolean; query: string; scope: SearchScope | null };
const initial: PaletteState = { open: false, query: '', scope: null };
let state: PaletteState = initial;
const listeners = new Set<() => void>();
function set(patch: Partial<PaletteState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
// The query is the phrase the palette opens holding; empty for the header control and the chord.
export function openSearchPalette(query = '') {
  set({ open: true, query });
}
export function closeSearchPalette() {
  set({ open: false, query: '' });
}
export function setSearchScope(scope: SearchScope | null) {
  set({ scope });
}
export function useSearchPalette() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}
