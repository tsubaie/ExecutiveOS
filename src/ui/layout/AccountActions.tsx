'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Sun, Moon, Languages } from 'lucide-react';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Locale } from '@/core/config/defaults';
import { routes } from '@/core/routes';
import { Button } from '@/ui/primitives/button';
// The three actions behind the avatar. They are here rather than in AccountMenu so that the theme
// provider, the locale mutation and the logout mutation are fetched when the menu is opened.
export function AccountActions({ onDone }: { onDone: () => void }) {
  return (
    <>
      <ThemeItem />
      <LocaleItem />
      <SignOut onDone={onDone} />
    </>
  );
}
function ThemeItem() {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2.5 font-normal"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun aria-hidden={true} className="hidden size-4 dark:block" />
      <Moon aria-hidden={true} className="size-4 dark:hidden" />
      {t('theme')}
    </Button>
  );
}
function LocaleItem() {
  const t = useTranslations('common');
  const locale = useLocale();
  const mutation = useMutation({
    mutationFn: () =>
      request('/preferences', z.object({ data: z.null() }), {
        method: 'POST',
        body: { locale: locale === Locale.enum.en ? Locale.enum.ar : Locale.enum.en },
      }),
    onSuccess: () => location.reload(),
  });
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2.5 font-normal"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Languages aria-hidden={true} className="size-4" />
        {t('locale')}
      </Button>
      {mutation.isError && (
        <span role="alert" className="px-2.5 text-xs text-danger">
          {mutation.error.message}
        </span>
      )}
    </>
  );
}
function SignOut({ onDone }: { onDone: () => void }) {
  const t = useTranslations('common');
  const client = useQueryClient();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: () =>
      request('/auth/logout', z.object({ data: z.null() }), { method: 'POST', body: {} }),
    onSuccess: () => {
      onDone();
      client.clear();
      router.push(routes.login());
      router.refresh();
    },
  });
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2.5 font-normal"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
    >
      <LogOut aria-hidden={true} className="size-4 rtl:rotate-180" />
      {t('logout')}
    </Button>
  );
}
