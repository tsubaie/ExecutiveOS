'use client';
import { useEffect } from 'react';
// EP-B30: a record's renderer is loaded on demand, so a list route never carries a chart runtime it
// may never need (docs/05). That download must not be what the reader waits through, though: the
// first row opened on a fresh page paused while the chunk arrived, and every row after it opened
// instantly — the record appeared to load once and then never again, which is exactly what it was
// doing. It is fetched shortly after the list is on screen instead, so by the time anything is
// clicked the module is already cached.
//
// `load` has to be stable, which means module scope. A fresh arrow function per render would make
// this run again on every one.
export function usePrefetch(load: () => Promise<object>) {
  // sync: a network fetch for code, deliberately outside anything React is rendering.
  useEffect(() => {
    const timer = setTimeout(() => void load().catch(() => undefined), 300);
    return () => clearTimeout(timer);
  }, [load]);
}
