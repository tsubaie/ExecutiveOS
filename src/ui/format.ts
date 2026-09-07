'use client';
import { useFormatter, useNow } from 'next-intl';
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
// Relative wording for timestamps ("2 hours ago"); pair it with the absolute value in a title.
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow();
  return (value: string) => format.relativeTime(new Date(value), now);
}
export function useCount() {
  const format = useFormatter();
  return (value: number) => format.number(value, 'integer');
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
