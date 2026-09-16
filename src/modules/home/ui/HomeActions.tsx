'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCount } from '@/ui/format';
import { Ageing, Row } from './HomeRow';
import { alarming, type Section } from './home-sections';

// HOME-B01: overdue and due today answer the same question — what do I have to do — and are one
// view in Tasks, so they are one block here with two bands. Two headings, two counts and two
// "View all" links made a page of ten sections feel like twelve. The overdue band keeps the
// danger count and the ageing split (HOME-B09); the due-today band stays neutral.
export function Actions({
  overdue,
  today,
}: {
  overdue: Section | undefined;
  today: Section | undefined;
}) {
  const t = useTranslations('home');
  const bands = [overdue, today].filter((section): section is Section => section !== undefined);
  const href = today?.href ?? overdue?.href ?? null;
  const carrying = bands.filter((section) => section.count > 0);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-b pb-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-base font-semibold">{t('actions')}</h2>
          {bands.map((section) => (
            <Count key={section.key} section={section} />
          ))}
        </div>
        {href && (
          <Link
            className="shrink-0 text-xs text-text-muted transition-colors duration-150 hover:text-accent hover:underline focus-visible:text-accent"
            href={href}
          >
            {t('viewAll')}
          </Link>
        )}
      </div>
      {carrying.length > 0 ? (
        carrying.map((section) => <Band key={section.key} section={section} />)
      ) : (
        <p className="py-4 text-sm text-text-muted">{t('emptyActions')}</p>
      )}
    </section>
  );
}
// The header states both counts so that zero overdue is still read as an answer (HOME-B02), even
// though a band with nothing in it is not drawn.
function Count({ section }: { section: Section }) {
  const t = useTranslations('home');
  const count = useCount();
  const danger = alarming(section);
  return (
    <span
      key={section.count}
      className={`count-tick shrink-0 text-sm tabular-nums ${danger ? 'rounded-md bg-danger-soft px-1.5 text-danger' : 'text-text-muted'}`}
    >
      {t('bandCount', { count: count(section.count), band: t(section.key) })}
    </span>
  );
}
function Band({ section }: { section: Section }) {
  const t = useTranslations('home');
  const danger = alarming(section);
  return (
    <div className="mt-3">
      <p
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 text-xs font-semibold ${danger ? 'text-danger' : 'text-text-muted'}`}
      >
        <span>{t(section.key)}</span>
        <Ageing section={section} />
      </p>
      <ul>
        {section.items.map((item) => (
          <li key={item.id} className="border-b last:border-b-0">
            <Row item={item} sectionKey={section.key} />
          </li>
        ))}
      </ul>
    </div>
  );
}
