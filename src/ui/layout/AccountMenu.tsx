'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Sun, Moon, Languages, UserCog } from 'lucide-react';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Locale } from '@/core/config/defaults';
import { routes } from '@/core/routes';
import { Avatar } from './Avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { Button } from '@/ui/primitives/button';
// ACCT: the reader's own controls, gathered behind their own face. Theme and locale used to sit
// loose in the header as two permanent buttons for a decision made twice a year (05 § Layout
// shell); they are preferences, so they live with the account that holds them and with the page
// that also sets them.
export function AccountMenu({ user }: { user: { name: string; email: string } }) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t('account')} className="rounded-full" />
        }
      >
        <Avatar name={user.name} className="size-7" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <div className="grid gap-0.5 border-b px-2.5 pt-1.5 pb-2.5">
          <p className="truncate font-medium">
            <bdi>{user.name}</bdi>
          </p>
          <p className="truncate text-xs text-text-muted" translate="no" dir="ltr">
            {user.email}
          </p>
        </div>
        <div className="grid gap-0.5 pt-1.5">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 font-normal"
            nativeButton={false}
            render={<Link href={routes.account()} onClick={() => setOpen(false)} />}
          >
            <UserCog aria-hidden={true} className="size-4" />
            {t('account')}
          </Button>
          <ThemeItem />
          <LocaleItem />
          <SignOut onDone={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
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
