import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/core/auth/session';
import { initialized } from '@/core/db/auth-repo';
import { settingValue } from '@/core/db/settings-repo';
import { db } from '@/core/db/client';
import { defaults } from '@/core/config/defaults';
import { AppShell } from '@/ui/layout/AppShell';
import { Providers } from '@/ui/layout/Providers';
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await initialized())) redirect('/setup');
  const user = await currentUser();
  if (!user) redirect('/login');
  const workspace = z
    .string()
    .parse((await settingValue(db(), 'workspace.name')) ?? defaults.workspaceName);
  return (
    <Providers key={user.id}>
      <AppShell user={user} workspace={workspace}>
        {children}
      </AppShell>
    </Providers>
  );
}
