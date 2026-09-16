'use client';
import { useFormatter, useNow, useTimeZone } from 'next-intl';
import { dayAt } from '@/core/time/tasks';
import { defaults } from '@/core/config/defaults';
// Every visible date and count goes through these hooks so numerals and the workspace timezone
// come from the request configuration (docs/05 § Internationalization). Plain dates are calendar
// values: they are rendered at UTC so the day never shifts, and never parsed with new Date(iso).
// A calendar day as a Date at UTC midnight, for formatting with `timeZone: 'UTC'`.
export function plainDateValue(day: string) {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}
export function usePlainDate() {
  const format = useFormatter();
  return (value: string) => format.dateTime(plainDateValue(value), 'day', { timeZone: 'UTC' });
}
// A calendar day as its weekday and as its number, for a strip where the month is implied.
export function useWeekday() {
  const format = useFormatter();
  return (value: string) => format.dateTime(plainDateValue(value), 'weekday', { timeZone: 'UTC' });
}
export function useDayOfMonth() {
  const format = useFormatter();
  return (value: string) =>
    format.dateTime(plainDateValue(value), 'dayOfMonth', { timeZone: 'UTC' });
}
export function useDateTime() {
  const format = useFormatter();
  return (value: string) => format.dateTime(new Date(value), 'dateTime');
}
// Relative wording for timestamps ("2 hours ago"); pair it with the absolute value in a title.
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow();
  return (value: string) => format.relativeTime(new Date(value), now);
}
// Today's calendar day in the user's timezone (docs/05 § Internationalization).
export function useToday() {
  const now = useNow();
  const timeZone = useTimeZone() ?? defaults.timezone;
  return dayAt(timeZone, now.toISOString());
}
export function useCount() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'integer');
}
// Measured quantities keep their decimals; percentages round to whole points and a change carries
// its sign, so a reader never has to infer direction from an arrow alone.
export function useDecimal() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'decimal');
}
// A reporting month, named rather than numbered: "Sep 2026" reads at a glance where "2026-09" has
// to be decoded. The period index is 1-based, the way a KPI's periods are counted.
export function useMonthYear() {
  const format = useFormatter();
  return (year: number, month: number) =>
    format.dateTime(new Date(Date.UTC(year, month - 1, 1)), 'monthYear', { timeZone: 'UTC' });
}
// A month on its own, for a column header where the year is already said once.
export function useMonth() {
  const format = useFormatter();
  return (month: number) =>
    format.dateTime(new Date(Date.UTC(2000, month - 1, 1)), 'month', { timeZone: 'UTC' });
}
export function useYear() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'year');
}
export function usePercent() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'percent');
}
export function useSignedPercent() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'signedPercent');
}
// How long ago a calendar day was, in words. A reading is dated to a day rather than an instant,
// so it is relativised at UTC midnight the way every other plain date is rendered.
export function useRelativeDay() {
  const format = useFormatter();
  const now = useNow();
  return (day: string) => format.relativeTime(plainDateValue(day), now);
}
// Up to two initials from a display name; works for Arabic and Latin names (PEOPLE-A06).
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}
