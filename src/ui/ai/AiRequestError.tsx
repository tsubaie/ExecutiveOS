'use client';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { ApiError } from '@/core/http/client';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
export function AiRequestError({ error }: { error: Error }) {
  const t = useTranslations('ai');
  if (!(error instanceof ApiError) || error.code !== 'ai_unavailable') return <ErrorPanel error={error} />;
  const detail = z.object({ reason: z.string().optional(), retryAfterMs: z.number().optional(), limit: z.number().optional() }).safeParse(error.details);
  if (!detail.success) return <ErrorPanel error={error} />;
  const reason = detail.data.reason;
  const message = reason === 'rate_limit' ? t('hourlyLimit', {
    limit: detail.data.limit ?? 30, minutes: Math.max(1, Math.ceil((detail.data.retryAfterMs ?? 3600000) / 60000)),
  }) : reason === 'budget' ? t('budgetLimit') : reason === 'context' ? t('contextLimit')
    : reason === 'model' ? t('modelUnavailable') : error.message;
  return <ErrorPanel error={new ApiError(error.code, message, error.details, error.requestId)} />;
}
