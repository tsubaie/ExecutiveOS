import { Temporal } from '@js-temporal/polyfill';
export function dayAt(timezone: string, instant = Temporal.Now.instant().toString()) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function addDays(day: string, days: number) {
  return Temporal.PlainDate.from(day).add({ days }).toString();
}
export function bandOf(task: { status: string; dueDate: string | null }, today: string) {
  if (task.status === 'completed') return null;
  if (!task.dueDate) return 'nodate';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return task.dueDate <= addDays(today, 7) ? 'week' : 'later';
}
