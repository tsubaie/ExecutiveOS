'use client';
import { useFormatter } from 'next-intl';
// Every visible date and count goes through these hooks so numerals and the workspace timezone
// come from the request configuration (docs/05 § Internationalization). Plain dates are calendar
// values: they are rendered at UTC so the day never shifts, and never parsed with new Date(iso).
export function usePlainDate() {
  const format = useFormatter();
  return (value: string) => {
    const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
    return format.dateTime(new Date(Date.UTC(year, month - 1, day)), 'day', { timeZone: 'UTC' });
  };
}
export function useDateTime() {
  const format = useFormatter();
  return (value: string) => format.dateTime(new Date(value), 'dateTime');
}
export function useCount() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'integer');
}
