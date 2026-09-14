'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Avatar } from '@/ui/layout/Avatar';
import { TaskCheck } from '@/modules/tasks/ui';
import { AgeingBar, Progress } from './HomeBar';
import { useCount, usePlainDate, useToday } from '@/ui/format';
import { alarming, daysBetween, type Item, type Section, type SectionKey } from './home-sections';

// The lead section is the one thing that must not be missed, so it is the only block given a raised
// surface. Everything else stays on the page ground: one rule under the heading, hairlines between
// rows. Depth comes from the neutral surface tokens, never from a colour tint, because only a soft
// tint's matching solid foreground is guaranteed to meet contrast (docs/05 § Density).
export function Stream({
  section,
  lead = false,
  quiet = false,
}: {
  section: Section;
  lead?: boolean;
  quiet?: boolean;
}) {
  const t = useTranslations('home');
  const c = useTranslations('common');
  const count = useCount();
  const danger = alarming(section);
  return (
    <section className={lead ? 'mt-8 rounded-xl border bg-surface px-5 py-4 lg:px-6' : ''}>
      <div className="flex items-baseline justify-between gap-4 border-b pb-2">
        <div className="flex items-baseline gap-2.5">
          <h2
            className={`truncate ${quiet ? 'text-sm font-medium text-text-muted' : 'text-base font-semibold'}`}
          >
            {t(section.key)}
          </h2>
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
      <Ageing section={section} />
      {section.items.length > 0 ? (
        <ul className={lead ? 'md:grid md:grid-cols-2 md:gap-x-10' : ''}>
          {section.items.map((item) => (
            <li key={item.id} className={lead ? '' : 'border-b last:border-b-0'}>
              <Row item={item} sectionKey={section.key} lead={lead} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-text-muted">{c('empty')}</p>
      )}
    </section>
  );
}

// HOME-B09: the shape of the pile, stated in figures with the mark only ranking them.
function Ageing({ section }: { section: Section }) {
  const t = useTranslations('home');
  // Nothing a month old means there is no shape to show: an all-neutral bar is a mark with no
  // information in it, and saying "none" out loud is noise on a screen that is already dense.
  // The absence is the message, so the whole line goes.
  if (!section.stale) return null;
  return (
    <p className="mt-3 flex items-center gap-2">
      <AgeingBar count={section.count} stale={section.stale} />
      <span className="text-xs font-medium tabular-nums text-danger">
        {t('staleOverdue', { count: section.stale })}
      </span>
    </p>
  );
}

// One status fact per row, chosen by the question the section answers: how late, who holds it, how
// much is open, when it happened.
function useStatus(item: Item, sectionKey: SectionKey) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  if (sectionKey === 'overdue' && item.date) {
    const late = daysBetween(item.date, today);
    return late > 0 ? { text: t('daysLate', { count: late }), alarming: true } : null;
  }
  // A waiting row is a person, so the fact is how much of the principal's work they are holding.
  if (sectionKey === 'waiting' && item.count !== null)
    return { text: t('holding', { count: item.count }), alarming: false };
  if (sectionKey === 'committees' && item.count !== null)
    return { text: t('openWork', { count: item.count }), alarming: false };
  if (sectionKey === 'notes' && item.date) return { text: date(item.date), alarming: false };
  return null;
}

// Title first, then the facts on their own line underneath. Pinning the facts to the far edge of a
// wide row leaves a gulf across the middle and makes a full page look empty.
// The row is not one link: a task the principal can finish here needs a control beside the link,
// and a button inside an anchor is neither valid nor operable.
// A task the principal can finish here gets a control; a task someone else holds gets their face.
function RowLead({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  if (item.revision !== null && (sectionKey === 'overdue' || sectionKey === 'today'))
    return (
      <TaskCheck
        task={{ id: item.id, title: item.title, revision: item.revision, completed: false }}
      />
    );
  // The row's title is the person's name, so the avatar repeats it and is decoration only.
  if (sectionKey === 'waiting' && item.owner)
    return (
      <span aria-hidden>
        <Avatar name={item.owner} className="mt-0.5" />
      </span>
    );
  return null;
}
// The facts line: what the row belongs to, then the one status fact its section calls for.
function RowFacts({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  const t = useTranslations('home');
  const status = useStatus(item, sectionKey);
  const facts = [item.committee, sectionKey === 'committees' ? item.owner : null].filter(Boolean);
  const late = sectionKey === 'committees' ? (item.overdue ?? 0) : 0;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
      {facts.map((fact) => (
        <bdi key={fact} className="truncate">
          {fact}
        </bdi>
      ))}
      {status && (
        <bdi className={`tabular-nums ${status.alarming ? 'font-medium text-danger' : ''}`}>
          {status.text}
        </bdi>
      )}
      {late > 0 && (
        <bdi className="font-medium tabular-nums text-danger">{t('lateOpen', { count: late })}</bdi>
      )}
      {sectionKey === 'committees' && item.done !== null && (
        <Progress done={item.done} open={item.count ?? 0} />
      )}
    </span>
  );
}
function Row({ item, sectionKey, lead }: { item: Item; sectionKey: SectionKey; lead: boolean }) {
  return (
    <div className="group -mx-2 flex items-start gap-3 rounded-md px-2 py-3 hover:bg-surface-raised">
      <RowLead item={item} sectionKey={sectionKey} />
      <Link href={item.href} title={item.title} className="min-w-0 flex-1">
        <span
          className={`block truncate text-start group-hover:text-accent ${lead ? 'text-[0.9375rem]' : 'text-sm'}`}
        >
          <bdi>{item.title}</bdi>
        </span>
        <RowFacts item={item} sectionKey={sectionKey} />
      </Link>
    </div>
  );
}
