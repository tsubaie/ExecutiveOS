import { addDays, dayOf, weekdayOf } from './days';
// Calendar arithmetic for the date picker. Days are `YYYY-MM-DD`, months `YYYY-MM`; weeks start on
// Sunday (docs/05 § Internationalization: Gregorian only in v1). ISO weekdays run Monday 1 to
// Sunday 7, so a Sunday-first column index is `weekday % 7`.
export const WEEK_DAYS = 7;
// Seven consecutive days starting on a Sunday, for weekday headings.
export const WEEKDAY_SAMPLE = [
  '2026-03-01',
  '2026-03-02',
  '2026-03-03',
  '2026-03-04',
  '2026-03-05',
  '2026-03-06',
  '2026-03-07',
];
export type GridCell = { key: string; day: string | null };
export function monthOf(day: string) {
  return day.slice(0, 7);
}
export function firstOfMonth(month: string) {
  return `${month}-01`;
}
export function addMonths(month: string, months: number) {
  const [year = 1970, index = 1] = month.split('-').map(Number);
  return dayOf(Date.UTC(year, index - 1 + months, 1)).slice(0, 7);
}
function daysInMonth(month: string) {
  const [year = 1970, index = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}
// Rows of seven; cells outside the month carry no day but keep a stable key so the grid holds
// its shape.
export function monthGrid(month: string): GridCell[][] {
  const first = firstOfMonth(month);
  const cells: GridCell[] = Array.from({ length: weekdayOf(first) % WEEK_DAYS }, (_, index) => ({
    key: `${month}:before:${index}`,
    day: null,
  }));
  for (let day = 0; day < daysInMonth(month); day += 1) {
    const value = addDays(first, day);
    cells.push({ key: value, day: value });
  }
  while (cells.length % WEEK_DAYS) cells.push({ key: `${month}:after:${cells.length}`, day: null });
  const rows: GridCell[][] = [];
  for (let start = 0; start < cells.length; start += WEEK_DAYS)
    rows.push(cells.slice(start, start + WEEK_DAYS));
  return rows;
}
// Saturday of the week containing `day`.
export function endOfWeek(day: string) {
  return addDays(day, 6 - (weekdayOf(day) % WEEK_DAYS));
}
// Monday of the following week.
export function startOfNextWeek(day: string) {
  return addDays(day, 8 - (weekdayOf(day) % WEEK_DAYS || WEEK_DAYS));
}
