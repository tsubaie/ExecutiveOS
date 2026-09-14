'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import { useHome } from './queries';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useCount } from '@/ui/format';
import { routes } from '@/core/routes';
type Section = {
  key:
    | 'nextMeetings'
    | 'prep'
    | 'overdue'
    | 'today'
    | 'waiting'
    | 'committees'
    | 'kpis'
    | 'initiatives'
    | 'notes';
  enabled: boolean;
  count: number;
  href: string | null;
  items: { id: string; title: string; href: string }[];
};
export function HomePage() {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const query = useHome();
  const count = useCount();
  if (query.isPending) return <HomeSkeleton />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data.data;
  // HOME-B02: a module the workspace never enabled is not news for the principal, so it is left out
  // instead of occupying a row. An enabled section stays even at zero, because zero is an answer.
  const live = data.sections.filter((section) => section.enabled);
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-12">
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
          {live.length > 0 ? (
            <div className="divide-y rounded-xl border bg-surface px-5">
              {live.map((section) => (
                <HomeSection key={section.key} section={section} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-surface px-5 py-10 text-center">
              <p className="text-sm">{t('empty')}</p>
              <p className="mt-2 text-sm text-text-muted">{t('emptyHint')}</p>
            </div>
          )}
        </section>
        <Link
          href={routes.people()}
          className="group rounded-xl border bg-surface p-6 hover:border-accent"
        >
          <div className="mb-6 flex items-start justify-between">
            <span className="rounded-lg bg-accent-soft p-2.5 text-accent">
              <Users className="size-5" aria-hidden />
            </span>
            <ArrowUpRight className="size-5 text-text-muted rtl:-rotate-90" aria-hidden />
          </div>
          <h2 className="text-sm font-medium">{t('directory')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{t('directoryDescription')}</p>
          <p className="mt-6 border-t pt-4 text-sm text-accent">
            {c('count', { count: count(data.peopleCount) })}
          </p>
        </Link>
      </div>
    </div>
  );
}

function HomeSection({ section }: { section: Section }) {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const count = useCount();
  return (
    <section className="py-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t(section.key)}</h3>
        {section.href && (
          <Link className="text-xs text-accent" href={section.href}>
            {c('count', { count: count(section.count) })}
          </Link>
        )}
      </div>
      {section.items.length > 0 && (
        <ul className="mt-2 grid">
          {section.items.map((item) => (
            <li key={item.id}>
              {/* Rows keep the 36px pointer and 44px touch target the density rules ask for. */}
              <Link
                href={item.href}
                title={item.title}
                className="-mx-2 flex min-h-9 items-center rounded-md px-2 text-sm hover:bg-surface-raised hover:text-accent pointer-coarse:min-h-11"
              >
                <bdi className="truncate">{item.title}</bdi>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The skeleton keeps the finished layout's shape so the page does not jump when the query lands.
function HomeSkeleton() {
  const c = useTranslations('common');
  const block = 'animate-pulse rounded-md bg-surface-raised';
  return (
    <div
      role="status"
      aria-label={c('loading')}
      className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-12"
    >
      <div className={`h-9 w-80 max-w-full ${block} lg:h-10`} />
      <div className={`mt-4 h-5 w-56 max-w-full ${block}`} />
      <div className="mt-10 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className={`mb-4 h-5 w-24 ${block}`} />
          <div className="divide-y rounded-xl border bg-surface px-5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex min-h-8 items-center justify-between gap-3 py-4">
                <div className={`h-4 w-40 max-w-[60%] ${block}`} />
                <div className={`h-3 w-14 ${block}`} />
              </div>
            ))}
          </div>
        </div>
        <div className={`h-56 ${block}`} />
      </div>
    </div>
  );
}
