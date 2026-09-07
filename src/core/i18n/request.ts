import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Locale, defaults } from '@/core/config/defaults';
import en from './messages/en.json';
import ar from './messages/ar.json';
export default getRequestConfig(async () => {
  const candidate = Locale.safeParse((await cookies()).get('eos_locale')?.value);
  const locale = candidate.success ? candidate.data : defaults.locale;
  return { locale, messages: locale === Locale.options[1] ? ar : en, timeZone: defaults.timezone };
});
