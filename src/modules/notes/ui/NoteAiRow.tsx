'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { LoaderCircle, RotateCw, TriangleAlert, WandSparkles } from 'lucide-react';
import { ApiError } from '@/core/http/client';
import { Button } from '@/ui/primitives/button';
import { AiAvailabilityNotice } from '@/ui/ai/AiReviewStatus';
import { type AiReview } from '@/ui/ai/queries';
// NOTES-B18 / B22: the AI's presence on the Content label row, as quiet as the field allows. One
// icon while there is nothing to report; a muted line while it works or after it could not; the
// off notice when AI is off. The one loud moment, a rewrite ready to review, is a strip on the
// field (RewriteReady), not this row.
export function NoteAiRow({ review, empty }: { review: AiReview; empty: boolean }) {
  const t = useTranslations('ai');
  if (review.pending) return <Working review={review} />;
  if (review.job?.status === 'failed') return <Failed review={review} />;
  if (!review.enabled) return <AiAvailabilityNotice review={review} />;
  if (empty) return null;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-accent"
      aria-label={t('refine')}
      title={t('refine')}
      onClick={() => review.start.mutate()}
    >
      <WandSparkles className="size-4" />
    </Button>
  );
}
// After a failure: what happened, the reason on hover, and one icon to try again.
function Failed({ review }: { review: AiReview }) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  return (
    <span className="flex items-center gap-1 text-sm text-text-muted">
      <span className="flex items-center gap-1.5" title={failureReason(review, t)}>
        <TriangleAlert className="size-4 text-danger/80" aria-hidden />
        {t('couldNotRefine')}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={c('retry')}
        title={c('retry')}
        onClick={() => review.start.mutate()}
      >
        <RotateCw className="size-4" />
      </Button>
    </span>
  );
}
// While it works: what is happening, how long it has been, and the way out.
function Working({ review }: { review: AiReview }) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const seconds = useElapsed(review.progressStartedAt ?? null);
  return (
    <span role="status" className="flex items-center gap-2 text-sm text-text-muted">
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {review.cancelling ? t('cancelling') : t('refining')}
      {seconds >= 10 && <span className="tabular-nums">{t('elapsedShort', { seconds })}</span>}
      {!review.cancelling && (
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={review.requestCancel}>
          {c('cancel')}
        </Button>
      )}
    </span>
  );
}
function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  // sync: the browser clock, once a second while the row is on screen.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}
type T = ReturnType<typeof useTranslations<'ai'>>;
function failureReason(review: AiReview, t: T) {
  const reason = review.job?.error;
  if (reason === 'billing') return t('billingFailed');
  if (reason === 'timeout') return t('timeoutFailed');
  if (reason === 'model_unavailable') return t('modelUnavailable');
  return t('failed');
}
// Why a refinement could not start, in one muted sentence on the field: a limit, the budget, the
// size of the note, or the model.
export function NoteAiStartError({ error }: { error: Error }) {
  const t = useTranslations('ai');
  return (
    <p role="status" className="text-sm text-text-muted">
      {startMessage(error, t)}
    </p>
  );
}
function startMessage(error: Error, t: T) {
  if (!(error instanceof ApiError) || error.code !== 'ai_unavailable') return error.message;
  const detail = z
    .object({
      reason: z.string().optional(),
      retryAfterMs: z.number().optional(),
      limit: z.number().optional(),
    })
    .safeParse(error.details);
  const reason = detail.success ? detail.data.reason : undefined;
  if (reason === 'rate_limit')
    return t('hourlyLimit', {
      limit: detail.success ? (detail.data.limit ?? 30) : 30,
      minutes: Math.max(
        1,
        Math.ceil((detail.success ? (detail.data.retryAfterMs ?? 3600000) : 3600000) / 60000),
      ),
    });
  if (reason === 'budget') return t('budgetLimit');
  if (reason === 'context') return t('contextLimit');
  if (reason === 'model') return t('modelUnavailable');
  return error.message;
}
