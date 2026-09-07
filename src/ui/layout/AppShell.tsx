'use client';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Command } from 'lucide-react';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { navigation } from './nav';
import { Preferences } from './Preferences';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
type ShellUser = { id: string; name: string; role: string };
export function AppShell({
  children,
  user,
  workspace,
}: {
  children: ReactNode;
  user: ShellUser;
  workspace: string;
}) {
  const t = useTranslations('common');
  const path = usePathname();
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () =>
      request('/auth/logout', z.object({ data: z.null() }), { method: 'POST', body: {} }),
    onSuccess: () => {
      client.clear();
      location.assign('/login');
    },
  });
  const entries = navigation.filter((item) => !item.admin || user.role === 'admin');
  const links = entries.map((item) => {
    const Icon = item.icon;
    const key = item.key;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={
          path.startsWith(item.href.split('/').slice(0, 2).join('/')) ? 'page' : undefined
        }
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent',
        )}
      >
        <Icon className="size-5" />
        {t(key)}
      </Link>
    );
  });
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e bg-surface p-5 lg:flex">
        <Link href="/home" className="mb-10 flex items-center gap-3 text-lg font-semibold">
          <Command className="size-7 text-accent" />
          {t('brand')}
        </Link>
        <p className="mb-3 px-3 text-xs text-text-muted">{t('workspace')}</p>
        <nav className="space-y-1">{links}</nav>
        <div className="mt-auto border-t pt-5">
          <p className="truncate font-medium">
            <bdi>{workspace}</bdi>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            <bdi>{user.name}</bdi>
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-18 items-center justify-between gap-2 border-b px-4 lg:px-8">
          <span className="truncate text-sm text-text-muted">
            <bdi>{workspace}</bdi>
          </span>
          <div className="flex items-center gap-1">
            <Preferences />
            <Button variant="ghost" aria-label={t('logout')} onClick={() => logout.mutate()}>
              <LogOut className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </header>
        <main id="content" className="min-w-0 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-surface px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {links}
      </nav>
    </div>
  );
}
