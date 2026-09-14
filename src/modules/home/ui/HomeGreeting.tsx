'use client';
import { useTranslations } from 'next-intl';
import { usePlainDate, useToday } from '@/ui/format';
import type { Section } from './home-sections';
// HOME-B07: the page opens on the day ahead, not on the deficit. Leading with what is late turns
// the first thing the principal reads every morning into a reprimand, and on a good day it makes a
// headline out of nothing being wrong. The lateness warning belongs in the overdue block, where it
// is already unmissable. Without the due-today section installed there is no day to state, so the
// standing subtitle returns.
export function Greeting({
  name,
  principal,
  live,
}: {
  name: string;
  principal: string | null;
  live: Section[];
}) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  const due = live.find((section) => section.key === 'today');
  return (
    <header className="max-w-4xl">
      <p className="text-sm text-text-muted">{date(today)}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
        {due ? t('today_headline', { count: due.count }) : t('title')}
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        {principal && principal !== name
          ? t('preparing', { name: principal })
          : t('greeting', { name })}
      </p>
    </header>
  );
}
