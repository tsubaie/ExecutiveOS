'use client';
import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { type AiReview } from './queries';
import { AiWorking, AiOutcome, reviewReady } from './AiReviewStatus';
import { AiRequestError } from './AiRequestError';
import { AiUnavailable } from './AiUnavailable';
export function AiPanel({
  review,
  title,
  children,
}: {
  review: AiReview;
  title: string;
  children: ReactNode;
}) {
  if (!review.enabled && !review.job && !review.pending) return null;
  return (
    <section className="my-5 space-y-4 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <Sparkles className="size-4 text-accent" />
        {title}
      </h3>
      <AiState review={review}>{children}</AiState>
    </section>
  );
}
function AiState({ review, children }: { review: AiReview; children: ReactNode }) {
  const t = useTranslations('ai');
  if (review.pending)
    return <AiWorking review={review} />;
  const result = review.job?.result;
  if (!reviewReady(review) || !result)
    return <AiStart review={review} />;
  return (
    <>
      {review.stale && (
        <p role="alert" className="text-sm text-danger">
          {t('stale')}
        </p>
      )}
      {result.warnings.length > 0 && (
        <p className="text-sm text-text-muted">
          {t('warnings', { count: result.warnings.length })}
        </p>
      )}
      {review.error && <AiRequestError error={review.error} />}
      {children}
    </>
  );
}
function AiStart({ review }: { review: AiReview }) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  return (
    <>
      <AiOutcome review={review} />
      {review.enabled && (
        <Button variant="outline" onClick={() => review.start.mutate()}>
          {review.job?.status === 'failed' ? c('retry') : t('generate')}
        </Button>
      )}
      {!review.enabled && <AiUnavailable review={review} />}
    </>
  );
}
