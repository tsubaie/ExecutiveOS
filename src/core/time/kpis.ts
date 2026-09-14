// Quarter arithmetic for the strategic scorecard (KPIS-B02). Quarters are calendar quarters of the
// workspace timezone: the caller passes the day that timezone is on, so nothing here needs a zone.
import { dayValue } from './days';
export type Quarter = { year: number; quarter: number };
export function quarterOf(day: string): Quarter {
  const [year = 1970, month = 1] = day.split('-').map(Number);
  return { year, quarter: Math.floor((month - 1) / 3) + 1 };
}
// A single comparable number, so "the current quarter or the earliest one after it" is one ordering.
export const quarterIndex = ({ year, quarter }: Quarter) => year * 4 + quarter;
export function previousQuarter({ year, quarter }: Quarter): Quarter {
  return quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
}
export function quarterRange({ year, quarter }: Quarter) {
  const month = (quarter - 1) * 3 + 1;
  const end = quarter === 4 ? { year: year + 1, month: 1 } : { year, month: month + 3 };
  const pad = (value: number) => String(value).padStart(2, '0');
  const last = new Date(dayValue(`${end.year}-${pad(end.month)}-01`) - 86_400_000);
  return { from: `${year}-${pad(month)}-01`, to: last.toISOString().slice(0, 10) };
}
// The canonical wire form of a quarter. The UI splits it to localize the digits; the API keeps a
// stable machine-readable label.
export const quarterLabel = ({ year, quarter }: Quarter) => `${year}-Q${quarter}`;
export function parseQuarterLabel(label: string): Quarter | null {
  const match = /^(\d{4})-Q([1-4])$/u.exec(label);
  return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
}
