'use client';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShellLinks } from './ShellLinks';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Command } from 'lucide-react';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Preferences } from './Preferences';
import { routes } from '@/core/routes';
import { Button } from '@/ui/primitives/button';
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
  const client = useQueryClient();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: () =>
      request('/auth/logout', z.object({ data: z.null() }), { method: 'POST', body: {} }),
    onSuccess: () => {
      client.clear();
      router.push(routes.login());
      router.refresh();
    },
  });

  return (
    // The shell owns the viewport: it is exactly one screen tall and the page scrolls inside its own
    // column, under a header and over a bottom bar that each hold their size. Nothing depends on
    // either of those heights being written down a second time in CSS, which is what left a strip of
    // empty ground under the page — and, on a phone, a control under the navigation bar.
    <div className="flex h-dvh flex-col overflow-hidden lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <Sidebar workspace={workspace} user={user} />
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex min-h-18 shrink-0 items-center justify-between gap-2 border-b px-4 lg:px-8">
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
        {/* The bottom bar floats over this column, so the page reserves its height rather than
            running under it. */}
        <main
          id="content"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
      </div>
      <nav className="mobile-navigation fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-surface px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ShellLinks role={user.role} />
      </nav>
    </div>
  );
}

function Sidebar({ workspace, user }: { workspace: string; user: ShellUser }) {
  const t = useTranslations('common');
  return (
    <aside className="app-sidebar hidden h-full flex-col overflow-y-auto border-e bg-surface p-5 lg:flex">
      <Link href={routes.home()} className="mb-10 flex items-center gap-3 text-lg font-semibold">
        <Command className="size-7 text-accent" />
        {t('brand')}
      </Link>
      <p className="mb-3 px-3 text-xs text-text-muted">{t('workspace')}</p>
      <nav className="space-y-1">
        <ShellLinks role={user.role} scope="primary" />
      </nav>
      {/* ADMIN-B19: administration is an occasional destination, so it sits with the workspace
          identity at the foot of the rail rather than among the everyday modules. */}
      <div className="mt-auto space-y-1">
        <nav className="space-y-1">
          <ShellLinks role={user.role} scope="admin" />
        </nav>
        <WorkspaceIdentity workspace={workspace} user={user} />
      </div>
    </aside>
  );
}
function WorkspaceIdentity({ workspace, user }: { workspace: string; user: ShellUser }) {
  return (
    <div className="border-t pt-5">
      <p className="truncate font-medium">
        <bdi>{workspace}</bdi>
      </p>
      <p className="mt-1 text-xs text-text-muted">
        <bdi>{user.name}</bdi>
      </p>
    </div>
  );
}
