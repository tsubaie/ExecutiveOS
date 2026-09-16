'use client';
import { useTranslations } from 'next-intl';
import { useHome } from './queries';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Greeting } from './HomeGreeting';
import { Stream } from './HomeStream';
import { Actions } from './HomeActions';
import { Week } from './HomeWeek';
import { gridRank, isAction, quiet, wide, type Section } from './home-sections';
const page = 'mx-auto max-w-[1400px] px-6 py-6 lg:px-10 lg:py-10';
export function HomePage() {
  const t = useTranslations('home');
  const query = useHome();
  if (query.isPending) return <HomeSkeleton />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data.data;
  // HOME-B02: a module the workspace never enabled is left out rather than given a row. An enabled
  // section stays even at zero, because zero overdue actions is an answer.
  const live: Section[] = data.sections.filter((section) => section.enabled);
  // HOME-B07, HOME-B14: the week leads, at full width and on the one raised surface, whenever the
  // module that owns dated work is installed. The task sections become the Actions block under it.
  const today = live.find((section) => section.key === 'today');
  const overdue = live.find((section) => section.key === 'overdue');
  // One grid of three columns under the week, in the order the principal asks (home-sections).
  const grid = live
    .filter((section) => !isAction(section))
    .sort((a, b) => gridRank(a) - gridRank(b));
  return (
    <div className={page}>
      <Greeting
        name={data.name}
        principal={data.principal}
        peopleCount={data.peopleCount}
        live={live}
      />
      {live.length > 0 ? (
        <>
          {today && <Week today={today} overdue={overdue} />}
          {/* A grid item will not shrink below its own min-content, and a committee named after
              a UUID has no break in it, so a column once grew past its track and carried every
              section's "View all" off the end of the screen with it (HOME-B13). Every template
              here says `minmax(0, …)`, the phone's single column included. */}
          <div className="home-column mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 lg:mt-10 lg:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-y-10">
            {(overdue || today) && <Actions overdue={overdue} today={today} />}
            {grid.map((section) => (
              <div
                key={section.key}
                className={wide(section) ? 'min-w-0 lg:col-span-2' : 'min-w-0'}
              >
                <Stream section={section} quiet={quiet(section)} wide={wide(section)} />
              </div>
            ))}
          </div>
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
      <div className={`mt-3 h-9 w-[32rem] max-w-full ${block} lg:h-10`} />
      <div className={`mt-3 h-4 w-48 ${block}`} />
      <div className={`mt-8 h-32 ${block}`} />
      <div className="mt-10 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div className={`h-40 ${block}`} />
        <div className={`h-32 ${block}`} />
        <div className={`h-32 ${block}`} />
      </div>
    </div>
  );
}
