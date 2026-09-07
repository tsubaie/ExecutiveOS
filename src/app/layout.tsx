import { type ReactNode } from 'react';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Providers } from '@/ui/layout/Providers';
import { Locale } from '@/core/config/defaults';
import '@/ui/tokens.css';
const latin = Inter({ subsets: ['latin'], variable: '--font-inter' });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});
export const metadata = {
  title: 'ExecutiveOS',
  description: 'Self-hosted operating surface for executive offices',
};
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations('common');
  return (
    <html lang={locale} dir={locale === Locale.options[1] ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${latin.variable} ${arabic.variable}`}>
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#content"
              className="fixed start-4 top-4 z-50 -translate-y-32 rounded-lg bg-accent px-4 py-3 text-primary-foreground focus:translate-y-0"
            >
              {t('skip')}
            </a>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
