'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/ui/cn';
import { useCount, useDayOfMonth, useWeekday } from '@/ui/format';
import type { Day, Section } from './home-sections';

// HOME-B14: the page's one raised block is the week ahead, drawn as a timeline. What is already
// late sits before a hairline — the line of "now" — and the seven days from today run after it,
// each column nothing but its date and, in words, how much lands on it. It is fixed rather than
// "whichever section has something in it" (HOME-B07): an executive orients on time, and a lead
// block that is Overdue on a bad morning and Attention KPIs on a quiet one gives them nothing to
// orient on. When the meetings module ships, its day list joins this block beside the strip.
//
// Two earlier drafts are worth recording. A row of tiles with the day number set like a headline
// read as a scorecard, not a calendar: a figure that size means "measure" everywhere else in the
// product. A row with one mark per task under each date said the same thing twice, once as marks
// and once as the count beneath them. What is left is the calendar's own grammar: the date as a
// label, today's number circled, the day's weight carried by the count and by nothing else.
export function Week({ today, overdue }: { today: Section; overdue: Section | undefined }) {
  const t = useTranslations('home');
  const days = today.days ?? [];
  const due = days.reduce((sum, day) => sum + day.count, 0);
  const cells = days.length + (overdue ? 1 : 0);
  return (
    <section className="home-rise home-lead mt-6 rounded-xl border bg-surface px-4 py-4 lg:mt-8 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b pb-2">
        <h2 className="flex min-w-0 items-baseline gap-2.5 text-base font-semibold">
          <span className="truncate">{t('week')}</span>
          <span
            key={due}
            className="count-tick shrink-0 text-sm font-normal tabular-nums text-text-muted"
          >
            {t('weekDue', { count: due })}
          </span>
        </h2>
        {/* The one link on the page with a chevron: it changes what the reader is looking at,
            from the week to the list of the day's work. */}
        {today.href && (
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:underline"
            href={today.href}
          >
            {t('openWeek')}
            <ChevronRight className="size-3 rtl:-scale-x-100" aria-hidden />
          </Link>
        )}
      </div>
      {/* Four columns to a row on a phone, the whole strip on one row from a tablet up. The row
          count is the cell count so a seven-day strip does not leave a gap where the overdue
          column would have been. */}
      <ul
        className={cn(
          'home-lead-rows mt-3 grid grid-cols-4 gap-x-1',
          cells === 8 ? 'sm:grid-cols-8' : 'sm:grid-cols-7',
        )}
      >
        {overdue && <OverdueCell section={overdue} />}
        {days.map((day, index) => (
          <DayCell key={day.date} day={day} today={index === 0} silent={due === 0} />
        ))}
      </ul>
    </section>
  );
}
const cell = 'flex min-w-0 flex-col gap-1 rounded-md px-2.5 py-2';
// The past, before the line of now. Overdue is the only state on the page that borrows the danger
// token, and only above zero; at zero the column reads as the neutral answer it is. The ageing
// split is not repeated here: the column is too narrow for the sentence, and the Actions band
// directly below already states it beside its bar (HOME-B09).
function OverdueCell({ section }: { section: Section }) {
  const t = useTranslations('home');
  const count = useCount();
  const late = section.count > 0;
  const body = (
    <>
      <span className="text-xs">{t('weekOverdue')}</span>
      <span key={section.count} className="count-tick text-sm font-semibold tabular-nums">
        {count(section.count)}
      </span>
    </>
  );
  return (
    <li className="min-w-0 border-e pe-1">
      {section.href ? (
        <Link
          href={section.href}
          className={cn(cell, 'hover:bg-surface-raised', late ? 'text-danger' : 'text-text-muted')}
        >
          {body}
        </Link>
      ) : (
        <span className={cn(cell, late ? 'text-danger' : 'text-text-muted')}>{body}</span>
      )}
    </li>
  );
}
// A day: its date as a label, today's number circled the way every calendar circles it, and the
// count in words — set in the text colour when there is something, and left muted when there is
// not, so the eye lands on the days that carry work. The whole column opens the task list
// narrowed to that day (HOME-B03, TASKS-B05).
// `silent`: when the heading has already said nothing is due, seven cells saying "none" say it
// seven more times; the date alone is the column, and the counts return with the first task.
function DayCell({ day, today, silent }: { day: Day; today: boolean; silent: boolean }) {
  const t = useTranslations('home');
  const weekday = useWeekday();
  const dayOfMonth = useDayOfMonth();
  return (
    <li aria-current={today ? 'date' : undefined} className="min-w-0">
      <Link
        href={day.href}
        className={cn(cell, 'hover:bg-surface-raised', today && 'bg-surface-raised')}
      >
        <span className="flex items-baseline gap-1.5 text-xs text-text-muted">
          <span className="truncate">{weekday(day.date)}</span>
          <span
            className={cn(
              'shrink-0 font-medium tabular-nums',
              today ? 'rounded-full bg-accent px-1.5 text-primary-foreground' : 'text-text',
            )}
          >
            {dayOfMonth(day.date)}
          </span>
        </span>
        <span
          className={cn(
            'min-h-5 text-sm tabular-nums',
            day.count > 0 ? 'font-medium text-text' : 'text-text-muted',
          )}
        >
          {!silent && (
            <span key={day.count} className="count-tick">
              {t('due', { count: day.count })}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
