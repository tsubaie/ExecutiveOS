'use client';
import { Suspense, lazy, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from './Avatar';
import { Popover, PopoverTrigger } from '@/ui/primitives/popover';
import { Button } from '@/ui/primitives/button';
// ACCT: the reader's own controls, gathered behind their own face. Theme and locale used to sit
// loose in the header as two permanent buttons for a decision made twice a year (05 § Layout
// shell); they are preferences, so they live with the account that holds them and with the page
// that also sets them.
const AccountPanel = lazy(() =>
  import('./AccountPanel').then((module) => ({ default: module.AccountPanel })),
);
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
      {/* The panel — its positioner, its portal and the three actions inside it — arrives when the
          menu is first opened. Only the avatar and its trigger belong on every route. */}
      {open && (
        <Suspense fallback={null}>
          <AccountPanel user={user} onDone={() => setOpen(false)} />
        </Suspense>
      )}
    </Popover>
  );
}
