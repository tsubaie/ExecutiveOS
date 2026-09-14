'use client';
import { useTranslations } from 'next-intl';
export function AiFailure({ reason }: { reason: string | null }) {
  const t = useTranslations('ai');
  const message = reason === 'billing' ? 'billingFailed'
    : reason === 'timeout' ? 'timeoutFailed'
    : reason === 'model_unavailable' ? 'modelUnavailable' : 'failed';
  return <p role="alert" className="my-3 text-sm text-danger">{t(message)}</p>;
}
