'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCount, usePlainDate, useToday } from '@/ui/format';
import { alarming, daysBetween, type Item, type Section, type SectionKey } from './home-sections';

// Sections are streams of rows on the page ground, not boxes: one rule under the heading and one
// hairline between rows. The lead runs two columns so the most pressing work fills the screen.
export function Stream({ section, lead = false }: { section: Section; lead?: boolean }) {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const count = useCount();
  const danger = alarming(section);
  return (
    <section className={lead ? 'mt-10' : ''}>
      <div className="flex items-baseline justify-between gap-4 border-b pb-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="truncate text-base font-semibold">{t(section.key)}</h2>
          <span
            className={`shrink-0 text-sm tabular-nums ${danger ? 'rounded-md bg-danger-soft px-1.5 text-danger' : 'text-text-muted'}`}
          >
            {count(section.count)}
          </span>
        </div>
        {section.href && (
          <Link className="shrink-0 text-xs text-accent hover:underline" href={section.href}>
            {t('viewAll')}
          </Link>
        )}
      </div>
      {section.items.length > 0 ? (
        <ul className={lead ? 'md:grid md:grid-cols-2 md:gap-x-14' : ''}>
          {section.items.map((item) => (
            <li key={item.id} className="border-b">
              <Row item={item} sectionKey={section.key} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-text-muted">{c('empty')}</p>
      )}
    </section>
  );
}

// One status fact per row plus the committee it belongs to. Which fact depends on the question the
// section answers: how late, who holds it, how much is open, when it happened.
function useStatus(item: Item, sectionKey: SectionKey) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  if (sectionKey === 'overdue' && item.date) {
    const late = daysBetween(item.date, today);
    return late > 0 ? { text: t('daysLate', { count: late }), alarming: true } : null;
  }
  if (sectionKey === 'waiting' && item.owner) return { text: item.owner, alarming: false };
  if (sectionKey === 'committees' && item.count !== null)
    return { text: t('openWork', { count: item.count }), alarming: false };
  if (sectionKey === 'notes' && item.date) return { text: date(item.date), alarming: false };
  return null;
}

function Row({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  const status = useStatus(item, sectionKey);
  return (
    <Link
      href={item.href}
      title={item.title}
      className="group -mx-3 flex min-h-11 items-center justify-between gap-6 rounded-md px-3 py-2.5 hover:bg-surface"
    >
      <bdi className="min-w-0 flex-1 truncate text-sm group-hover:text-accent">{item.title}</bdi>
      <span className="flex shrink-0 items-center gap-4 text-xs">
        {item.committee && (
          <bdi className="hidden max-w-56 truncate text-text-muted sm:block">{item.committee}</bdi>
        )}
        {status && (
          <bdi className={`tabular-nums ${status.alarming ? 'text-danger' : 'text-text-muted'}`}>
            {status.text}
          </bdi>
        )}
      </span>
    </Link>
  );
}
