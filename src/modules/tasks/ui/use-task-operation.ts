'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SaveState } from '@/ui/entity/types';
// One in-flight action at a time with the same states as the panel's save queue, so secondary
// forms (subtask dialogs) report saving, saved and failure the same way (EP-B10).
export function useTaskOperation() {
  const t = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  // sync: expire the transient saved announcement after two seconds.
  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  async function run(action: () => Promise<object>, done?: () => void) {
    setState('saving');
    setError(null);
    try {
      await action();
      setState('saved');
      done?.();
    } catch (error) {
      setState('error');
      setError(error instanceof Error ? error : new Error(t('error')));
    }
  }
  return { error, state, pending: state === 'saving', run };
}
