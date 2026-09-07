'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMutation } from '@tanstack/react-query';
import { Sun, Moon, Languages } from 'lucide-react';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Locale } from '@/core/config/defaults';
import { Button } from '@/ui/primitives/button';
export function Preferences() {
  const t = useTranslations('common');
  const locale = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const mutation = useMutation({
    mutationFn: () =>
      request('/preferences', z.object({ data: z.null() }), {
        method: 'POST',
        body: { locale: locale === Locale.enum.en ? Locale.enum.ar : Locale.enum.en },
      }),
    onSuccess: () => location.reload(),
  });
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        aria-label={t('theme')}
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      >
        <Sun className="hidden size-4 dark:block" />
        <Moon className="size-4 dark:hidden" />
      </Button>
      <Button variant="ghost" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        <Languages className="size-4" />
        {t('locale')}
      </Button>
      {mutation.isError && <span role="alert">{mutation.error.message}</span>}
    </div>
  );
}
