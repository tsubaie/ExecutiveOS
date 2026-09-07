'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
export function useTaskOperation() {
  const t = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<object>, done?: () => void) {
    setPending(true);
    setError(null);
    try {
      await action();
      done?.();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('error')));
    } finally {
      setPending(false);
    }
  }
  return { error, pending, run };
}
