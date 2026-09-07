'use client';
import { useEffect, useRef, useState } from 'react';
import type { Entity } from './types';
type Leaving<T> = { item: T; after: string | null };
export type Rendered<T> = { item: T; leaving: boolean };
const EXIT_MS = 320;
// Rows that just left the list stay rendered, inert, for one exit animation so a completed,
// trashed or restored item fades out instead of vanishing. A full replacement (view or filter
// change) is not animated: only a few rows leaving at a time count as an exit.
export function useLeavingRows<T extends Entity>(items: T[], pending: boolean): Rendered<T>[] {
  const previous = useRef<T[]>(items);
  const [leaving, setLeaving] = useState<Leaving<T>[]>([]);
  // sync: diff against the last rendered list and schedule the removal of exited rows.
  useEffect(() => {
    if (pending) {
      previous.current = [];
      return;
    }
    const ids = new Set(items.map((item) => item.id));
    const gone = previous.current
      .map((item, index) => ({ item, after: previous.current[index - 1]?.id ?? null }))
      .filter(({ item }) => !ids.has(item.id));
    const replaced = gone.length === previous.current.length && items.length > 0;
    previous.current = items;
    if (!gone.length || gone.length > 3 || replaced) return;
    setLeaving((current) => [...current, ...gone]);
    setTimeout(
      () => setLeaving((current) => current.filter((entry) => !gone.includes(entry))),
      EXIT_MS,
    );
  }, [items, pending]);
  if (!leaving.length) return items.map((item) => ({ item, leaving: false }));
  const rendered: Rendered<T>[] = [];
  const present = new Set(items.map((item) => item.id));
  const pushLeaving = (after: string | null) => {
    for (const entry of leaving)
      if (entry.after === after && !present.has(entry.item.id))
        rendered.push({ item: entry.item, leaving: true });
  };
  pushLeaving(null);
  for (const item of items) {
    rendered.push({ item, leaving: false });
    pushLeaving(item.id);
  }
  return rendered;
}
