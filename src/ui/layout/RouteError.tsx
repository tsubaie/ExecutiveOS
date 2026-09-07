'use client';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from './ErrorPanel';
export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div className="p-8">
      <ErrorPanel error={new Error(t('internal'))} retry={reset} />
    </div>
  );
}
