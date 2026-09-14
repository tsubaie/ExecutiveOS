// Reporting-period arithmetic for the strategic scorecard (KPIS-B02). A KPI is read at the cadence
// it is actually reported on — monthly, quarterly or annually — so every period question takes the
// KPI's frequency rather than assuming quarters. Periods are calendar periods of the workspace
// timezone: the caller passes the day that timezone is on, so nothing here needs a zone.
import { dayValue } from './days';
export type Frequency = 'monthly' | 'quarterly' | 'annual';
export type Period = { year: number; period: number };
export const periodsPerYear = (frequency: Frequency) =>
  frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
const monthsPerPeriod = (frequency: Frequency) => 12 / periodsPerYear(frequency);
export function periodOf(day: string, frequency: Frequency): Period {
  const [year = 1970, month = 1] = day.split('-').map(Number);
  return { year, period: Math.floor((month - 1) / monthsPerPeriod(frequency)) + 1 };
}
// A single comparable number, so "the current period or the earliest one after it" is one ordering
// and "the period before this" is subtraction.
export const periodIndex = ({ year, period }: Period, frequency: Frequency) =>
  year * periodsPerYear(frequency) + (period - 1);
export function shiftPeriod(from: Period, by: number, frequency: Frequency): Period {
  const size = periodsPerYear(frequency);
  const index = periodIndex(from, frequency) + by;
  return { year: Math.floor(index / size), period: (index % size) + 1 };
}
export function periodRange({ year, period }: Period, frequency: Frequency) {
  const size = monthsPerPeriod(frequency);
  const month = (period - 1) * size + 1;
  const after = month + size;
  const end = after > 12 ? { year: year + 1, month: after - 12 } : { year, month: after };
  const pad = (value: number) => String(value).padStart(2, '0');
  const last = new Date(dayValue(`${end.year}-${pad(end.month)}-01`) - 86_400_000);
  return { from: `${year}-${pad(month)}-01`, to: last.toISOString().slice(0, 10) };
}
// Whether a reading taken on `day` is still the cadence's current one. KPIS-B01 calls a reading
// stale once it is more than one period behind, which is one missed report rather than a count of
// days: a monthly KPI and an annual one are late at very different speeds.
export function periodsBehind(day: string, today: string, frequency: Frequency) {
  return periodIndex(periodOf(today, frequency), frequency) - periodIndex(periodOf(day, frequency), frequency);
}
