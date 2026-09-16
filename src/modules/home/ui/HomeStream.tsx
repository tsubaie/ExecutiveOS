'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCount } from '@/ui/format';
import { Card, Row } from './HomeRow';
import { emptyKey, type Section } from './home-sections';

// A section on the page ground: one rule under the heading, hairlines between rows. Depth comes
// from the neutral surface tokens, never from a colour tint, because only a soft tint's matching
// solid foreground is guaranteed to meet contrast (docs/05 § Density). The one raised surface on
// the page is the week block (HOME-B07), and the task sections are drawn together as the Actions
// block; everything else arrives here.
export function Stream({
  section,
  quiet = false,
  wide = false,
}: {
  section: Section;
  quiet?: boolean;
  wide?: boolean;
}) {
  const t = useTranslations('home');
  const count = useCount();
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-b pb-2">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2
            className={`truncate ${quiet ? 'text-sm font-medium text-text-muted' : 'text-base font-semibold'}`}
          >
            {t(section.key)}
          </h2>
          <span
            key={section.count}
            className="count-tick shrink-0 text-sm tabular-nums text-text-muted"
          >
            {count(section.count)}
          </span>
        </div>
        {section.href && (
          <Link
            className="shrink-0 text-xs text-text-muted transition-colors duration-150 hover:text-accent hover:underline focus-visible:text-accent"
            href={section.href}
          >
            {t('viewAll')}
          </Link>
        )}
      </div>
      <Items section={section} wide={wide} />
    </section>
  );
}
// HOME-B02: an empty section answers its own question where it has one, and says the generic
// line only where it does not.
function Items({ section, wide }: { section: Section; wide: boolean }) {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const empty = emptyKey(section.key);
  if (section.items.length === 0)
    return <p className="py-4 text-sm text-text-muted">{empty ? t(empty) : c('empty')}</p>;
  if (wide)
    return (
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {section.items.map((item) => (
          <li key={item.id} className="min-w-0">
            <Card item={item} sectionKey={section.key} />
          </li>
        ))}
      </ul>
    );
  return (
    <ul>
      {section.items.map((item) => (
        <li key={item.id} className="border-b last:border-b-0">
          <Row item={item} sectionKey={section.key} />
        </li>
      ))}
    </ul>
  );
}
