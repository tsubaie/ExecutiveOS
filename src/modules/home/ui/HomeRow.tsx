'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserX } from 'lucide-react';
import { Avatar } from '@/ui/layout/Avatar';
import { MeterArc } from '@/ui/layout/Meter';
import { cn } from '@/ui/cn';
import { TaskCheck } from '@/modules/tasks/ui';
import { useKpiLabels } from '@/modules/kpis/ui';
import { KpiStatus } from '@/modules/kpis/schema/validation';
import { AgeingBar, Late, Progress } from './HomeBar';
import { usePlainDate, useToday } from '@/ui/format';
import { daysBetween, type Item, type Section, type SectionKey } from './home-sections';

// HOME-B09: the shape of the overdue pile, stated in figures with the mark only ranking them.
export function Ageing({ section }: { section: Section }) {
  const t = useTranslations('home');
  // Nothing a month old means there is no shape to show: an all-neutral bar is a mark with no
  // information in it, and saying "none" out loud is noise on a screen that is already dense.
  // The absence is the message, so the whole line goes.
  if (!section.stale) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <AgeingBar count={section.count} stale={section.stale} />
      <span className="text-xs font-medium tabular-nums text-danger">
        {t('staleOverdue', { count: section.stale })}
      </span>
    </span>
  );
}

// One status fact per row, chosen by the question the section answers: how late, who holds it, how
// much is open, when it happened.
function useStatus(item: Item, sectionKey: SectionKey) {
  const t = useTranslations('home');
  const date = usePlainDate();
  const today = useToday();
  // HOME-B07: the band and the summaries carry the danger token; the figure on the row ranks the
  // rows and does not need to shout as well.
  if (sectionKey === 'overdue' && item.date) {
    const late = daysBetween(item.date, today);
    return late > 0 ? { text: t('daysLate', { count: late }), alarming: false } : null;
  }
  if (sectionKey === 'committees' && item.count !== null)
    return { text: t('openWork', { count: item.count }), alarming: false };
  if (sectionKey === 'notes' && item.date) return { text: date(item.date), alarming: false };
  return null;
}
// The second fact a chase-list row carries: when the earliest thing this person holds falls due,
// which is what decides between two holders with the same count (HOME-B10).
function EarliestDue({ item }: { item: Item }) {
  const t = useTranslations('home');
  const date = usePlainDate();
  if (!item.date) return null;
  return <bdi className="tabular-nums">{t('earliestDue', { date: date(item.date) })}</bdi>;
}
// How much of what a row carries is already late (HOME-B09, HOME-B10): the figure in danger with
// the mark beside it, or nothing at all when nothing is late.
function LateShare({ item }: { item: Item }) {
  const t = useTranslations('home');
  const late = item.overdue ?? 0;
  if (late <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-danger">
      <Late late={late} open={item.count ?? 0} />
      <bdi className="tabular-nums">{t('lateOpen', { count: late })}</bdi>
    </span>
  );
}
// What a committee row says about the work it carries: its late share and how far it has got.
function CommitteeFacts({ item }: { item: Item }) {
  return (
    <>
      <LateShare item={item} />
      {item.done !== null && <Progress done={item.done} open={item.count ?? 0} />}
    </>
  );
}
// A KPI row is a measure, so its facts are the scorecard's: how far through the target it is and
// the state that puts it on this page, in the scorecard's own words and tone (KPIS-B07).
function KpiFacts({ item }: { item: Item }) {
  const t = useTranslations('home');
  const k = useTranslations('kpis');
  const labels = useKpiLabels();
  const status = KpiStatus.safeParse(item.status);
  if (!status.success) return null;
  // One fact here, the state word at the row's end (KpiState): a measure without a reading says
  // so rather than leaving an empty arc beside a bare chip.
  return (
    <bdi className="tabular-nums">
      {item.ratio !== null
        ? t('ofTarget', { percent: labels.percent(item.ratio) })
        : k('noReading')}
    </bdi>
  );
}
function KpiState({ item }: { item: Item }) {
  const labels = useKpiLabels();
  const status = KpiStatus.safeParse(item.status);
  if (!status.success) return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
        labels.chip(status.data),
      )}
    >
      {labels.status(status.data)}
    </span>
  );
}
function KpiMark({ item }: { item: Item }) {
  const labels = useKpiLabels();
  const status = KpiStatus.safeParse(item.status);
  if (!status.success) return null;
  // The figures beside the arc carry the information; the arc only paces them (docs/05 § Charts).
  return (
    <span aria-hidden className="relative grid size-7 place-items-center">
      <MeterArc ratio={item.ratio} tone={labels.tone(status.data)} className="absolute inset-0" />
    </span>
  );
}
// HOME-B01: every row in the grid starts with the same 28 px slot, whatever it holds — the check,
// a face, an arc — so the titles align across the three columns and the grid reads as one
// instrument rather than three unrelated lists. Sections whose rows lead with nothing have no slot.
const leading: readonly SectionKey[] = ['overdue', 'today', 'waiting', 'kpis'];

// Title first, then the facts on their own line underneath. Pinning the facts to the far edge of a
// wide row leaves a gulf across the middle and makes a full page look empty.
// The row is not one link: a task the principal can finish here needs a control beside the link,
// and a button inside an anchor is neither valid nor operable.
// A task the principal can finish here gets a control; a task someone else holds gets their face;
// a measure gets its arc.
function RowLead({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  if (!leading.includes(sectionKey)) return null;
  return (
    <span className="grid size-7 shrink-0 place-items-center">
      <LeadContent item={item} sectionKey={sectionKey} />
    </span>
  );
}
function LeadContent({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  if (item.revision !== null && (sectionKey === 'overdue' || sectionKey === 'today'))
    return (
      <TaskCheck
        task={{ id: item.id, title: item.title, revision: item.revision, completed: false }}
      />
    );
  // The row's title is the person's name, so the avatar repeats it and is decoration only. The
  // unassigned row takes the same slot with an empty face, so the titles stay in one column.
  if (sectionKey === 'waiting')
    return (
      <span aria-hidden>
        {item.owner ? (
          <Avatar name={item.owner} />
        ) : (
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed text-text-muted">
            <UserX className="size-3" />
          </span>
        )}
      </span>
    );
  if (sectionKey === 'kpis') return <KpiMark item={item} />;
  return null;
}
// HOME-B10: the holder's count sits at the row's end edge as a figure, in the same place a
// committee's fraction sits, so the primary fact of a chase-list row has one position and the
// facts line keeps only what is late and what is due first.
function RowEnd({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  const t = useTranslations('home');
  if (sectionKey === 'waiting' && item.count !== null)
    return (
      <span className="shrink-0 pt-0.5 text-sm tabular-nums text-text-muted">
        {t('holding', { count: item.count })}
      </span>
    );
  if (sectionKey === 'kpis') return <KpiState item={item} />;
  return null;
}
// The facts line: what the row belongs to, then the one status fact its section calls for.
function RowFacts({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  const status = useStatus(item, sectionKey);
  // A KPI's objective is left off: the scorecard already groups by it, and here the measure's own
  // name and state are the whole answer.
  const facts = [
    sectionKey === 'kpis' ? null : item.committee,
    sectionKey === 'committees' ? item.owner : null,
  ].filter(Boolean);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
      {/* A fact is user text of any length. `truncate` alone does not shrink a flex item — its
          automatic minimum is its content — so one unbroken committee name stretched the section
          past the screen and took the row's "View all" off the end of it with it. */}
      {facts.map((fact) => (
        <bdi key={fact} className="min-w-0 truncate">
          {fact}
        </bdi>
      ))}
      {status && (
        <bdi className={`tabular-nums ${status.alarming ? 'font-medium text-danger' : ''}`}>
          {status.text}
        </bdi>
      )}
      {sectionKey === 'waiting' && (
        <>
          <LateShare item={item} />
          <EarliestDue item={item} />
        </>
      )}
      {sectionKey === 'committees' && <CommitteeFacts item={item} />}
      {sectionKey === 'kpis' && <KpiFacts item={item} />}
    </span>
  );
}
export function Row({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  const t = useTranslations('home');
  // HOME-B10: the chase list's one row that is not a person — waiting work nobody holds — arrives
  // untitled and is named here, in the reader's language.
  const title = item.title || (sectionKey === 'waiting' ? t('unassigned') : item.title);
  return (
    <div className="group -mx-2 flex items-start gap-3 rounded-md px-2 py-3 transition-colors duration-150 hover:bg-surface-raised">
      <RowLead item={item} sectionKey={sectionKey} />
      <Link href={item.href} title={title} className="min-w-0 flex-1">
        <span className="block truncate text-start text-sm transition-colors duration-150 group-hover:text-accent">
          <bdi>{title}</bdi>
        </span>
        <RowFacts item={item} sectionKey={sectionKey} />
      </Link>
      <RowEnd item={item} sectionKey={sectionKey} />
    </div>
  );
}
// HOME-B01: reference material drawn as cards in a row rather than as a column of rows — the
// notes section spans the grid's spare columns, and three cards are the shape three notes take.
export function Card({ item, sectionKey }: { item: Item; sectionKey: SectionKey }) {
  return (
    <Link
      href={item.href}
      title={item.title}
      className="group block min-w-0 rounded-lg border px-3 py-2.5 transition-colors duration-150 hover:bg-surface-raised"
    >
      <span className="block truncate text-sm transition-colors duration-150 group-hover:text-accent">
        <bdi>{item.title}</bdi>
      </span>
      <RowFacts item={item} sectionKey={sectionKey} />
    </Link>
  );
}
