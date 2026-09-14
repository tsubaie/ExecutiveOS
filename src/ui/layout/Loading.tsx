'use client';
import { useTranslations } from 'next-intl';
import { LoaderCircle } from 'lucide-react';
import { PagePlaceholder } from './PageTransition';
export default function Loading() {
  const t = useTranslations('common');
  return (
    <PagePlaceholder>
      <div role="status" className="flex items-center justify-center gap-3 p-12 text-text-muted">
        <LoaderCircle className="size-5 animate-spin" />
        {t('loading')}
      </div>
    </PagePlaceholder>
  );
}
