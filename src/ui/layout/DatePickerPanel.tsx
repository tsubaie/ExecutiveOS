'use client';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import { plainDateValue as atUtc, useCount, usePlainDate } from '@/ui/format';
import { addDays } from '@/core/time/tasks';
import {
  WEEKDAY_SAMPLE,
  addMonths,
  endOfWeek,
  firstOfMonth,
  monthGrid,
  monthOf,
  startOfNextWeek,
} from '@/core/time/calendar';
export type PanelProps = {
  value: string | null;
  today: string;
  pick: (day: string | null) => void;
};
// The body of the date picker, loaded when the popover first opens: quick picks above a
// Sunday-first month grid showing only the month's own days.
export default function DatePickerPanel({ value, today, pick }: PanelProps) {
  return (
    <>
      <QuickPicks today={today} value={value} pick={pick} />
      <MonthGrid initial={value ?? today} value={value} today={today} pick={pick} />
    </>
  );
}
function QuickPicks({ today, value, pick }: PanelProps) {
  const t = useTranslations('common');
  const options: { key: 'today' | 'tomorrow' | 'endOfWeek' | 'nextWeek'; day: string }[] = [
    { key: 'today', day: today },
    { key: 'tomorrow', day: addDays(today, 1) },
    { key: 'endOfWeek', day: endOfWeek(today) },
    { key: 'nextWeek', day: startOfNextWeek(today) },
  ];
  return (
    <div className="mb-3 grid grid-cols-2 gap-1.5">
      {options.map((option) => (
        <Button
          key={option.key}
          size="sm"
          variant={value === option.day ? 'secondary' : 'outline'}
          className="h-7 min-h-0 px-2 text-xs"
          onClick={() => pick(option.day)}
        >
          {t(option.key)}
        </Button>
      ))}
      {value && (
        <Button
          size="sm"
          variant="ghost"
          className="col-span-2 h-7 min-h-0 px-2 text-xs text-text-muted"
          onClick={() => pick(null)}
        >
          {t('noDate')}
        </Button>
      )}
    </div>
  );
}
function MonthHeader({ month, setMonth }: { month: string; setMonth: (month: string) => void }) {
  const t = useTranslations('common');
  const format = useFormatter();
  return (
    <div className="mb-1 flex items-center justify-between">
      <Button
        size="icon-sm"
        variant="ghost"
        className="min-h-0"
        aria-label={t('previousMonth')}
        onClick={() => setMonth(addMonths(month, -1))}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </Button>
      <span className="text-sm font-medium">
        {format.dateTime(atUtc(firstOfMonth(month)), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        className="min-h-0"
        aria-label={t('nextMonth')}
        onClick={() => setMonth(addMonths(month, 1))}
      >
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
function MonthGrid({
  initial,
  value,
  today,
  pick,
}: PanelProps & { initial: string; pick: (day: string) => void }) {
  const format = useFormatter();
  const count = useCount();
  const plainDate = usePlainDate();
  const [month, setMonth] = useState(monthOf(initial));
  return (
    <div className="grid gap-1">
      <MonthHeader month={month} setMonth={setMonth} />
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-text-muted">
        {WEEKDAY_SAMPLE.map((day) => (
          <span key={day} aria-hidden>
            {format.dateTime(atUtc(day), { weekday: 'short', timeZone: 'UTC' })}
          </span>
        ))}
      </div>
      {monthGrid(month).map((row) => (
        <div key={row[0]?.key} className="grid grid-cols-7 gap-y-0.5">
          {row.map((cell) =>
            cell.day ? (
              <Button
                key={cell.key}
                size="icon-sm"
                variant="ghost"
                aria-label={plainDate(cell.day)}
                aria-pressed={cell.day === value}
                className={cn(
                  'mx-auto size-8 min-h-0 rounded-full p-0 text-sm font-normal tabular-nums',
                  cell.day === today && cell.day !== value && 'ring-1 ring-accent/60 ring-inset',
                  cell.day === value && 'bg-accent text-primary-foreground hover:bg-accent',
                )}
                onClick={() => pick(cell.day ?? '')}
              >
                {count(Number(cell.day.slice(8)))}
              </Button>
            ) : (
              <span key={cell.key} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
