'use client';
import { useTranslations } from 'next-intl';
import { useHome } from './queries';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Greeting, StatBand } from './HomeStats';
import { Stream } from './HomeStream';
import type { Section } from './home-sections';
const page = 'mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-10';
export function HomePage() {
  const t = useTranslations('home');
  const query = useHome();
  if (query.isPending) return <HomeSkeleton />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data.data;
  // HOME-B02: a module the workspace never enabled is left out rather than given a row. An enabled
  // section stays even at zero, because zero overdue actions is an answer.
  const live: Section[] = data.sections.filter((section) => section.enabled);
  // HOME-B07: the first section that actually has something in it leads, at full width. The section
  // order is the product's urgency order, so the lead is whatever is most pressing today.
  const lead = live.find((section) => section.count > 0);
  const rest = live.filter((section) => section !== lead);
  return (
    <div className={page}>
      <Greeting name={data.name} principal={data.principal} />
      {live.length > 0 ? (
        <>
          <StatBand live={live} peopleCount={data.peopleCount} />
          {lead && <Stream section={lead} lead />}
          {rest.length > 0 && (
            <div className="mt-10 grid items-start gap-x-14 gap-y-10 xl:grid-cols-2">
              {rest.map((section) => (
                <Stream key={section.key} section={section} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 border-t pt-10 text-center">
          <p className="text-sm">{t('empty')}</p>
          <p className="mt-2 text-sm text-text-muted">{t('emptyHint')}</p>
        </div>
      )}
    </div>
  );
}

// The skeleton keeps the finished layout's shape so the page does not jump when the query lands.
function HomeSkeleton() {
  const c = useTranslations('common');
  const block = 'animate-pulse rounded-md bg-surface-raised';
  return (
    <div role="status" aria-label={c('loading')} className={page}>
      <div className={`h-4 w-28 ${block}`} />
      <div className={`mt-3 h-9 w-80 max-w-full ${block} lg:h-10`} />
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-y py-5 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((tile) => (
          <div key={tile}>
            <div className={`h-9 w-12 ${block}`} />
            <div className={`mt-2 h-4 w-20 ${block}`} />
          </div>
        ))}
      </div>
      <div className={`mt-10 h-32 ${block}`} />
      <div className="mt-10 grid items-start gap-x-14 gap-y-10 xl:grid-cols-2">
        <div className={`h-32 ${block}`} />
        <div className={`h-32 ${block}`} />
      </div>
    </div>
  );
}
