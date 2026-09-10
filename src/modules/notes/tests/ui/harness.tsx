import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/core/i18n/messages/en.json';
import ar from '@/core/i18n/messages/ar.json';
// Component scenarios render inside the same providers the app uses; queries never retry so a
// missing network fails fast and the component under test shows its fallback state.
export function mount(node: ReactNode, locale: 'en' | 'ar' = 'en') {
  cleanup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="UTC"
      now={new Date('2026-09-10T09:00:00Z')}
      formats={{
        number: { integer: { maximumFractionDigits: 0 } },
        dateTime: {
          day: { calendar: 'gregory', day: 'numeric', month: 'short', year: 'numeric' },
          dateTime: { dateStyle: 'medium', timeStyle: 'short' },
        },
      }}
    >
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
