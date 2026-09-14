'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCount, usePlainDate, useToday } from '@/ui/format';
import { routes } from '@/core/routes';
import type { Section } from './home-sections';
// HOME-B07: the page opens on the day ahead, not on the deficit. Leading with what is late turns
// the first thing the principal reads every morning into a reprimand, and on a good day it makes a
// headline out of nothing being wrong. The lateness warning belongs in the overdue block, where it
// is already unmissable. Without the due-today section installed there is no day to state, so the
// standing subtitle returns.
export function Greeting({
  name,
  principal,
  peopleCount,
  live,
}: {
  name: string;
  principal: string | null;
  peopleCount: number;
  live: Section[];
}) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  const count = useCount();
  const due = live.find((section) => section.key === 'today');
  return (
    <header className="home-rise max-w-4xl">
      <p className="text-sm text-text-muted">{date(today)}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
        {due ? t('today_headline', { count: due.count }) : t('title')}
      </h1>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-text-muted">
        <span>
          {principal && principal !== name
            ? t('preparing', { name: principal })
            : t('greeting', { name })}
        </span>
        {/* The directory is one line rather than the panel it used to be: the entry point and the
            headcount are worth keeping, a column spent on one number was not. */}
        <Link href={routes.people()} className="text-accent hover:underline">
          {t('directory')} <span className="tabular-nums">{count(peopleCount)}</span>
        </Link>
      </p>
    </header>
  );
}
