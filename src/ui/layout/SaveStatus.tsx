'use client';
import { useTranslations } from 'next-intl';
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import { cn } from '@/ui/cn';
import type { SaveState } from '@/ui/entity/types';
// One way to say "your change is safe": a spinner while saving, a tick for two seconds after,
// a warning that stays until retried. Announced through a live region (EP-B10).
export function SaveStatus({ state, className }: { state: SaveState; className?: string }) {
  const t = useTranslations('common');
  const failed = state === 'error' || state === 'conflict';
  return (
    <span
      role="status"
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors',
        state === 'saving' && 'bg-surface-raised text-text-muted',
        state === 'saved' && 'bg-accent-soft text-accent',
        failed && 'bg-danger-soft text-danger',
        className,
      )}
    >
      {state === 'saving' && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      {state === 'saved' && <Check className="size-3.5" aria-hidden />}
      {failed && <TriangleAlert className="size-3.5" aria-hidden />}
      {state === 'saving' && t('saving')}
      {state === 'saved' && t('saved')}
      {failed && t('saveFailed')}
    </span>
  );
}
