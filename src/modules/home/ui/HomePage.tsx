'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowUpRight, Users, Minus } from 'lucide-react';
import { useHome } from './queries';
import Loading from '@/ui/layout/Loading';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
export function HomePage() {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const query = useHome();
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data.data;
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-12">
      <p className="mb-3 text-sm text-accent">{t('overview')}</p>
      <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
        {t('greeting', { name: data.name })}
      </h1>
      <p className="mt-3 text-text-muted">{t('title')}</p>
      {data.principal && data.principal !== data.name && (
        <p className="mt-2 text-sm text-text-muted">{t('preparing', { name: data.principal })}</p>
      )}
      <div className="mt-10 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h2 className="mb-4 text-sm font-medium">{t('overview')}</h2>
          <div className="divide-y rounded-xl border bg-surface px-5">
            {data.sections.map((section) => (
              <div
                key={section.key}
                className="flex min-h-16 items-center justify-between gap-3 py-3"
              >
                <span className="text-sm">{t(section.key)}</span>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  <Minus className="size-3" />
                  {t('disabled')}
                </span>
              </div>
            ))}
          </div>
        </section>
        <Link href="/people" className="group rounded-xl border bg-surface p-6 hover:border-accent">
          <div className="mb-8 flex items-start justify-between">
            <span className="rounded-lg bg-accent/10 p-3 text-accent">
              <Users className="size-6" />
            </span>
            <ArrowUpRight className="size-5 text-text-muted rtl:-rotate-90" />
          </div>
          <h2 className="text-lg font-semibold">{t('directory')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {t('directoryDescription')}
          </p>
          <p className="mt-6 border-t pt-4 text-sm text-accent">
            {c('count', { count: data.peopleCount })}
          </p>
        </Link>
      </div>
    </div>
  );
}
