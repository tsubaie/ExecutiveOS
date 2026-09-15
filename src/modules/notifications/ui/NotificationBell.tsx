'use client';
import { Suspense, lazy, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Popover, PopoverTrigger } from '@/ui/primitives/popover';
import { useCount } from '@/ui/format';
import { useNotifications } from './queries';
// Same reasoning as the palette: the bell and its count are small and belong on every route; the
// list behind it is not, and arrives when the reader opens it.
const NotificationList = lazy(() =>
  import('./NotificationList').then((module) => ({ default: module.NotificationList })),
);
// ADR 0022: pull-only. The bell is read when the reader opens it; nothing here reaches them
// outside the application. NOTIF-B07: opening the centre marks nothing read.
export function NotificationBell() {
  const t = useTranslations('notifications');
  const count = useCount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const feed = useNotifications();
  const unread = feed.data?.data.unread ?? 0;
  const items = feed.data?.data.items ?? [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={unread > 0 ? t('unread', { count: unread }) : t('title')}
            className="relative"
          />
        }
      >
        <Bell aria-hidden={true} className="size-4" />
        {unread > 0 && (
          // EP-B24: keyed on its own value, so a new arrival replaces the figure rather than
          // quietly redrawing it.
          <span
            key={unread}
            aria-hidden={true}
            className="count-tick absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold tabular-nums text-bg"
          >
            {unread > 99 ? '99+' : count(unread)}
          </span>
        )}
      </PopoverTrigger>
      {open && (
        <Suspense fallback={null}>
          <NotificationList
            items={items}
            unread={unread}
            pending={feed.isPending}
            onOpen={(href) => {
              setOpen(false);
              router.push(href);
            }}
          />
        </Suspense>
      )}
    </Popover>
  );
}
