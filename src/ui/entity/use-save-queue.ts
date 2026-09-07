'use client';
import { useState } from 'react';
import { createSaveQueue } from './save-queue';
import type { Entity, SaveState } from './types';
export function useSaveQueue<T extends Entity, P extends object>(
  entity: T | undefined,
  patch: (id: string, revision: number, input: P, key: string) => Promise<T>,
  reload?: () => Promise<T | undefined>,
) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [queue] = useState(() =>
    createSaveQueue(patch, (state, error) => {
      setState(state);
      setError(error);
    }),
  );
  return {
    state,
    error,
    save: (input: P) => queue.save(entity, input),
    retry: () => queue.retry(reload),
    settle: queue.settle,
    discard: queue.discard,
  };
}
