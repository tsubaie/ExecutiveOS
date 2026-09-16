'use client';
import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/ui/cn';
import { usePlainDate, useToday } from '@/ui/format';
import { routes } from '@/core/routes';
import { type Section, type SectionKey, alarming } from './home-sections';
// HOME-B07: the page opens on the day ahead, not on the deficit. Leading with what is late turns
// the first thing the principal reads every morning into a reprimand, and on a good day it makes a
// headline out of nothing being wrong. Without the due-today section installed there is no day to
// state, so the standing subtitle returns.
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
  const due = live.find((section) => section.key === 'today');
  return (
    <header className="home-rise">
      <p className="text-sm text-text-muted">{date(today)}</p>
      <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
        {due ? t('today_headline', { count: due.count }) : t('title')}
      </h1>
      {/* The directory sits at the far edge of the line rather than beside the ledger: it is a
          way out of the page, not part of the day's account. */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-text-muted">
        <Ledger live={live} principal={principal !== name ? principal : null} />
        <Link href={routes.people()} className="shrink-0 text-accent hover:underline">
          {t('directory')} <span className="tabular-nums">{peopleCount}</span>
        </Link>
      </div>
    </header>
  );
}
// HOME-B05: the line under the headline is the page in one breath — each section's count, in
// the order the sections come, each a way into its section. It replaced a greeting that repeated
// what the rail foot already says in a heavier weight. Overdue is the only entry in the danger
// ink, and only above zero; an entry at zero is still stated, quieter, because zero is an answer.
type LedgerLabel =
  'ledger_overdue' | 'ledger_waiting' | 'ledger_kpis' | 'ledger_committees' | 'ledger_initiatives';
const ledger: readonly { key: SectionKey; label: LedgerLabel }[] = [
  { key: 'overdue', label: 'ledger_overdue' },
  { key: 'waiting', label: 'ledger_waiting' },
  { key: 'kpis', label: 'ledger_kpis' },
  { key: 'committees', label: 'ledger_committees' },
  { key: 'initiatives', label: 'ledger_initiatives' },
];
function Ledger({ live, principal }: { live: Section[]; principal: string | null }) {
  const t = useTranslations('home');
  const entries = ledger.flatMap(({ key, label }) => {
    const section = live.find((item) => item.key === key);
    return section ? [{ section, label }] : [];
  });
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      {principal && <span>{t('preparing', { name: principal })}</span>}
      {entries.map(({ section, label }, index) => (
        <Fragment key={section.key}>
          {(index > 0 || principal) && (
            <span aria-hidden className="text-text-faint">
              ·
            </span>
          )}
          <LedgerEntry section={section} label={label} />
        </Fragment>
      ))}
    </p>
  );
}
function LedgerEntry({ section, label }: { section: Section; label: LedgerLabel }) {
  const t = useTranslations('home');
  const text = t(label, { count: section.count });
  const ink = alarming(section)
    ? 'font-medium text-danger'
    : section.count > 0
      ? 'text-text'
      : 'text-text-muted';
  if (!section.href) return <span className={ink}>{text}</span>;
  return (
    <Link
      href={section.href}
      className={cn('tabular-nums transition-colors duration-150 hover:text-accent', ink)}
    >
      {text}
    </Link>
  );
}
