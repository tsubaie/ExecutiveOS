'use client';
import { useFormatter, useTranslations } from 'next-intl';
import { addDays } from '@/core/time/tasks';
import { plainDateValue as atUtc, usePlainDate, useToday } from '@/ui/format';
import type { Task } from '../schema/validation';
export type DueLabel = { label: string; absolute: string; tone: 'danger' | 'accent' | 'muted' };
// Lists show relative due labels and keep the absolute date for hover (tasks.md § UI): overdue
// counts days back, today and tomorrow are words, the rest of the week is a weekday, later is
// the date. The band comes from the server (TASKS-B03); only the wording is decided here.
export function useDueLabel() {
  const t = useTranslations('tasks');
  const format = useFormatter();
  const plainDate = usePlainDate();
  const today = useToday();
  return (task: Pick<Task, 'dueDate' | 'band'>): DueLabel | null => {
    if (!task.dueDate) return null;
    const absolute = plainDate(task.dueDate);
    if (task.band === 'today') return { label: t('today'), absolute, tone: 'accent' };
    if (task.band === 'overdue')
      return {
        label:
          task.dueDate === addDays(today, -1)
            ? t('yesterday')
            : format.relativeTime(atUtc(task.dueDate), atUtc(today)),
        absolute,
        tone: 'danger',
      };
    if (task.band === 'week' && task.dueDate <= addDays(today, 6))
      return {
        label:
          task.dueDate === addDays(today, 1)
            ? t('tomorrow')
            : format.dateTime(atUtc(task.dueDate), { weekday: 'long', timeZone: 'UTC' }),
        absolute,
        tone: 'muted',
      };
    return { label: absolute, absolute, tone: 'muted' };
  };
}
