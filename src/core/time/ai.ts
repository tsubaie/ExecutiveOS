import { Temporal } from '@js-temporal/polyfill';
export function monthStart(timezone: string) {
  return new Date(
    Number(
      Temporal.Now.zonedDateTimeISO(timezone).with({
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      }).epochMilliseconds,
    ),
  );
}

export function retryDelay(value: string | null | undefined) {
  if (!value) return 30000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? Math.max(0, instant - Date.now()) : 30000;
}
