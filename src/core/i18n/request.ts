import 'server-only';
import { getRequestConfig } from 'next-intl/server';
import type { DateTimeFormatOptions } from 'next-intl';
import { cookies } from 'next/headers';
import { Locale, defaults } from '@/core/config/defaults';
import { currentUser } from '@/core/auth/session';
import { db } from '@/core/db/client';
import { getSetting, hasSetting } from '@/core/db/settings-repo';
import en from './messages/en.json';
import ar from './messages/ar.json';
// Locale from the cookie; timezone and numerals from user settings, then workspace settings.
type Numerals = 'arab' | 'latn';
async function preferences(): Promise<{ timeZone: string; numberingSystem: Numerals }> {
  try {
    const database = db();
    const user = await currentUser();
    const userTimezone = user && (await hasSetting(database, 'user.timezone', user.id));
    const userNumerals = user && (await hasSetting(database, 'user.numerals', user.id));
    const timeZone = userTimezone
      ? await getSetting(database, 'user.timezone', user.id)
      : await getSetting(database, 'workspace.timezone');
    const numerals = userNumerals
      ? (await getSetting(database, 'user.numerals', user.id)) === 'arabic'
      : await getSetting(database, 'workspace.arabic_numerals');
    return { timeZone, numberingSystem: numerals ? 'arab' : 'latn' };
  } catch {
    return { timeZone: defaults.timezone, numberingSystem: 'latn' };
  }
}
export default getRequestConfig(async () => {
  const candidate = Locale.safeParse((await cookies()).get('eos_locale')?.value);
  const locale = candidate.success ? candidate.data : defaults.locale;
  const { timeZone, numberingSystem } = await preferences();
  const day: DateTimeFormatOptions = {
    calendar: 'gregory',
    numberingSystem,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  return {
    locale,
    messages: locale === Locale.options[1] ? ar : en,
    timeZone,
    formats: {
      dateTime: { day, dateTime: { ...day, hour: 'numeric', minute: '2-digit' } },
      number: { integer: { numberingSystem, maximumFractionDigits: 0 } },
    },
  };
});
