'use client';
import { useTranslations } from 'next-intl';
import type { AiReview } from './queries';
import { AiProgress } from './AiProgress';
import { AiRequestError } from './AiRequestError';
import { AiFailure } from './AiFailure';
import { AiUnavailable } from './AiUnavailable';
export function AiWorking({ review }: { review: AiReview }) {
  const status = review.job?.status;
  const stage = status === 'running' || status === 'queued' ? status : 'starting';
  return <AiProgress startedAt={review.progressStartedAt} onCancel={review.requestCancel}
    cancelling={review.cancelling} cancelError={review.cancel.error} stage={stage} />;
}
export function AiOutcome({ review }: { review: AiReview }) {
  const t = useTranslations('ai');
  if (review.pending) return <AiWorking review={review} />;
  if (review.error) return <AiRequestError error={review.error} />;
  if (review.job?.status === 'failed') return <AiFailure reason={review.job.error} />;
  if (review.job?.status === 'cancelled') return <p role="status" className="mb-4 text-sm text-text-muted">{t('cancelled')}</p>;
  if (review.job?.result?.appliedIds) return <p role="status" className="mb-4 text-sm text-success">{t('applied')}</p>;
  return null;
}
export function AiAvailabilityNotice({ review }: { review: AiReview }) {
  if (review.pending || review.enabled || review.checkingAvailability) return null;
  return <AiUnavailable review={review} />;
}
export function reviewReady(review: AiReview) {
  const result = review.job?.result;
  return review.job?.status === 'succeeded' && Boolean(result) && !result?.appliedIds && !result?.discarded;
}
