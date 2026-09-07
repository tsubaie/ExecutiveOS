'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { ApiError } from '@/core/http/client';
export function ErrorPanel({ error, retry }: { error: Error; retry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
      <p>{error.message}</p>
      {error instanceof ApiError && (
        <p className="mt-1 break-all text-xs text-text-muted">{error.requestId}</p>
      )}
      {retry && (
        <Button variant="outline" className="mt-3" onClick={retry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
