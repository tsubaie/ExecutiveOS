'use client';
import { useCallback, useSyncExternalStore } from 'react';
// EP-B29: which presentation the list is read in. Two stores, deliberately: the URL is the truth
// while it says anything, so a link opens in the layout it was sent in and a reader can hand
// someone the table they were looking at; local storage remembers the last explicit choice per
// module, so coming back to Tasks tomorrow does not undo it. The URL is not written until the
// reader chooses, which keeps the common link short and keeps a remembered preference out of
// every link they share.
//
// The remembered value is read through `useSyncExternalStore` rather than an effect: local storage
// is exactly the external store that primitive exists for, it has no value on the server, and
// reading it this way keeps the first client render agreeing with the markup instead of correcting
// it a frame later.
const key = (module: string) => `eos.layout.${module}`;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function read(module: string) {
  try {
    return window.localStorage.getItem(key(module));
  } catch {
    // A browser that refuses storage still switches; it just does not remember.
    return null;
  }
}
export function useEntityLayout(
  module: string,
  fromUrl: string,
  offered: boolean,
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void,
) {
  const remembered = useSyncExternalStore(
    subscribe,
    () => read(module),
    () => null,
  );
  const setLayout = useCallback(
    (value: string) => {
      try {
        window.localStorage.setItem(key(module), value);
      } catch {
        // As above: the choice still applies to this page through the URL.
      }
      for (const listener of listeners) listener();
      navigate({ layout: value || null }, true);
    },
    [module, navigate],
  );
  return { layout: offered ? fromUrl || (remembered ?? '') : '', setLayout };
}
