'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { LoaderCircle } from 'lucide-react';
export function AiProgress({ stage, startedAt, onCancel, cancelling = false, cancelError }: {
  startedAt?: number | null;
  stage: 'starting' | 'queued' | 'running'; onCancel?: () => void; cancelling?: boolean; cancelError?: Error | null;
}) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const elapsed = Math.max(0, Math.floor((now - (startedAt ?? mountedAt)) / 1000));
  // sync: update the elapsed display from the browser clock, retaining the durable job origin.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <div className="my-4 space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
    <div role="status" className="flex items-center gap-3">
      <LoaderCircle aria-hidden={true} className="size-5 shrink-0 animate-spin text-accent motion-reduce:animate-none" />
      <p className="font-medium">{t(cancelling ? 'cancelling' : stage === 'starting' ? 'progressStarting' : stage === 'queued' ? 'progressQueued' : 'progressRunning')}</p>
    </div>
    <p className="text-sm text-text-muted">{t(stage === 'starting' ? 'progressStartingHelp' : 'progressHelp')}</p>
    {stage === 'running' && elapsed >= 30 && <p className="text-sm text-text-muted">{t('progressSlow')}</p>}
    <p className="text-xs text-text-muted">{t('progressElapsed', { seconds: elapsed })}</p>
    {onCancel && <Button type="button" variant="outline" disabled={cancelling} onClick={onCancel}>{cancelling ? t('cancelling') : c('cancel')}</Button>}
    {cancelError && <ErrorPanel error={cancelError} />}
  </div>;
}
