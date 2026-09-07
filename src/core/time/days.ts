// Calendar-day arithmetic without the Temporal polyfill, so client bundles stay small. Days are
// `YYYY-MM-DD` strings; arithmetic runs at UTC midnight where no zone can shift the date.
const DAY_MS = 86_400_000;
export function dayValue(day: string) {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}
export function dayOf(utcMs: number) {
  return new Date(utcMs).toISOString().slice(0, 10);
}
export function addDays(day: string, days: number) {
  return dayOf(dayValue(day) + days * DAY_MS);
}
// ISO weekday: Monday 1 … Sunday 7.
export function weekdayOf(day: string) {
  const sunday = new Date(dayValue(day)).getUTCDay();
  return sunday === 0 ? 7 : sunday;
}
// The calendar day at an instant in a timezone. Intl options pin Gregorian and Latin digits, so
// the result does not depend on the runtime locale.
export function dayAt(timezone: string, instant = new Date().toISOString()) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
