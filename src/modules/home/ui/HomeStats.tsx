'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCount, usePlainDate, useToday } from '@/ui/format';
import { routes } from '@/core/routes';
import { alarming, statLabel, type Section } from './home-sections';

// The date frames everything under it: "overdue" and "due today" only mean something against it.
export function Greeting({ name, principal }: { name: string; principal: string | null }) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  return (
    <header>
      <p className="text-sm text-text-muted">{date(today)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
        {t('greeting', { name })}
      </h1>
      {principal && principal !== name && (
        <p className="mt-1.5 text-sm text-text-muted">{t('preparing', { name: principal })}</p>
      )}
    </header>
  );
}

// One instrument band rather than a row of cards: hairlines between readings, nothing boxed.
export function StatBand({ live, peopleCount }: { live: Section[]; peopleCount: number }) {
  const t = useTranslations('home');
  return (
    <div className="mt-8 grid grid-cols-2 border-y sm:grid-cols-3 lg:grid-cols-6">
      {live.map((section, index) => (
        <Stat
          key={section.key}
          href={section.href}
          value={section.count}
          label={t(statLabel[section.key])}
          danger={alarming(section)}
          divided={index > 0}
        />
      ))}
      <Stat
        href={routes.people()}
        value={peopleCount}
        label={t('statPeople')}
        danger={false}
        divided={live.length > 0}
      />
    </div>
  );
}

function Stat({
  href,
  value,
  label,
  danger,
  divided,
}: {
  href: string | null;
  value: number;
  label: string;
  danger: boolean;
  divided: boolean;
}) {
  const count = useCount();
  const shell = `py-5 ${divided ? 'lg:border-s lg:ps-5' : ''}`;
  const body = (
    <>
      <span
        className={`block text-3xl font-semibold tabular-nums lg:text-4xl ${danger ? 'text-danger' : ''}`}
      >
        {count(value)}
      </span>
      <span className="mt-1 block truncate text-sm text-text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${shell} hover:opacity-70`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
