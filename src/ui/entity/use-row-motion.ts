'use client';
import { useEffect, useRef, useState } from 'react';
import type { Entity } from './types';
type Leaving<T> = { item: T; after: string | null };
export type Rendered<T> = { item: T; leaving: boolean; entering: boolean };
// A row is either arriving or leaving, never both, so the two states share one class slot.
export const rowMotionClass = (row: { leaving: boolean; entering: boolean }) =>
  row.leaving ? 'entity-row-leaving' : row.entering ? 'entity-row-entering' : undefined;
const EXIT_MS = 320;
const ENTER_MS = 280;
// A handful of rows changing is an event; the whole list changing is a different screen.
const BATCH = 3;
// EP-B12: rows that just left the list stay rendered, inert, for one exit animation so a
// completed, trashed or restored item fades out instead of vanishing, and rows that just arrived
// rise in rather than appearing. Both are keyed off identity against the previous render, and both
// are skipped for a full replacement (view, filter or search change) or a first load: only a few
// rows moving at a time count as an event, and a screen that redraws entirely is not one.
export function useRowMotion<T extends Entity>(items: T[], pending: boolean): Rendered<T>[] {
  const previous = useRef<T[]>(items);
  const [leaving, setLeaving] = useState<Leaving<T>[]>([]);
  const [entering, setEntering] = useState<string[]>([]);
  // The diff is against the last rendered list; the timers end each animation's window.
  // sync: DOM row identity across renders.
  useEffect(() => {
    if (pending) {
      previous.current = [];
      return;
    }
    const ids = new Set(items.map((item) => item.id));
    const before = previous.current;
    const beforeIds = new Set(before.map((item) => item.id));
    const gone = before
      .map((item, index) => ({ item, after: before[index - 1]?.id ?? null }))
      .filter(({ item }) => !ids.has(item.id));
    const arrived = items.filter((item) => !beforeIds.has(item.id)).map((item) => item.id);
    const replaced = gone.length === before.length && items.length > 0;
    const fresh = before.length === 0;
    previous.current = items;
    if (arrived.length && !fresh && !replaced && arrived.length <= BATCH) {
      setEntering((current) => [...current, ...arrived]);
      setTimeout(
        () => setEntering((current) => current.filter((id) => !arrived.includes(id))),
        ENTER_MS,
      );
    }
    if (!gone.length || gone.length > BATCH || replaced) return;
    setLeaving((current) => [...current, ...gone]);
    setTimeout(
      () => setLeaving((current) => current.filter((entry) => !gone.includes(entry))),
      EXIT_MS,
    );
  }, [items, pending]);
  const arriving = new Set(entering);
  if (!leaving.length)
    return items.map((item) => ({ item, leaving: false, entering: arriving.has(item.id) }));
  const rendered: Rendered<T>[] = [];
  const present = new Set(items.map((item) => item.id));
  const pushLeaving = (after: string | null) => {
    for (const entry of leaving)
      if (entry.after === after && !present.has(entry.item.id))
        rendered.push({ item: entry.item, leaving: true, entering: false });
  };
  pushLeaving(null);
  for (const item of items) {
    rendered.push({ item, leaving: false, entering: arriving.has(item.id) });
    pushLeaving(item.id);
  }
  return rendered;
}
