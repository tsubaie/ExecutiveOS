'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { type AiReview } from './queries';
export function AiUnavailable({ review }: { review: AiReview }) {
  const t = useTranslations('ai');
  return <div className="my-3 space-y-2 rounded-lg border p-3 text-sm">
    <p className="text-text-muted">{t('unavailableHelp')}</p>
    <Button variant="outline" disabled={review.checkingAvailability}
      onClick={() => void review.recheckAvailability()}>{t('checkAvailability')}</Button>
  </div>;
}
