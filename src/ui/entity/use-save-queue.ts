'use client';
import { useRef, useState } from 'react';
import { ApiError } from '@/core/http/client';
import type { Entity, SaveState } from './types';
export function useSaveQueue<T extends Entity, P extends object>(
  entity: T | undefined,
  patch: (id: string, revision: number, input: P, key: string) => Promise<T>,
) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const queue = useRef<{
    pending: P | null;
    failed: P | null;
    current: T | undefined;
    running: Promise<void> | null;
    key: string | null;
  }>({ pending: null, failed: null, current: undefined, running: null, key: null });
  async function drain() {
    const q = queue.current;
    if (q.running) return q.running;
    if (!q.current || !q.pending) return;
    const current = q.current;
    const payload = q.pending;
    q.pending = null;
    q.key ??= crypto.randomUUID();
    setState('saving');
    q.running = patch(current.id, current.revision, payload, q.key)
      .then(
        (next) => {
          q.current = next;
          q.failed = null;
          q.key = null;
          setState('saved');
          setError(null);
        },
        (error) => {
          q.failed = payload;
          setState(error instanceof ApiError && error.code === 'conflict' ? 'conflict' : 'error');
          setError(error instanceof Error ? error : new Error('save_failed'));
        },
      )
      .finally(() => {
        q.running = null;
      });
    await q.running;
    if (!q.failed && q.pending) await drain();
  }
  function save(input: P) {
    const q = queue.current;
    if (!q.running && !q.failed) q.current = entity;
    q.pending = { ...q.pending, ...input };
    void drain();
  }
  async function settle() {
    await queue.current.running;
    return !queue.current.failed;
  }
  async function retry() {
    const q = queue.current;
    q.pending = q.pending && q.failed ? { ...q.failed, ...q.pending } : (q.pending ?? q.failed);
    q.failed = null;
    await drain();
  }
  function discard() {
    queue.current.failed = null;
    queue.current.pending = null;
    queue.current.key = null;
    setError(null);
    setState('idle');
  }
  return { state, error, save, settle, retry, discard };
}
