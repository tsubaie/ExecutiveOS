'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { useCount } from '@/ui/format';
import { useNotifications, useMarkAllRead } from './queries';
import type { Notification } from '../schema/validation';
import { NotificationRow } from './NotificationRow';
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
      <NotificationList
        items={items}
        unread={unread}
        pending={feed.isPending}
        onOpen={(href) => {
          setOpen(false);
          router.push(href);
        }}
      />
    </Popover>
  );
}
// The centre itself. NOTIF-B12: the empty state names the purpose and offers nothing, because
// there is no action a reader can take that creates a notification.
function NotificationList({
  items,
  unread,
  pending,
  onOpen,
}: {
  items: Notification[];
  unread: number;
  pending: boolean;
  onOpen: (href: string) => void;
}) {
  const t = useTranslations('notifications');
  const markAll = useMarkAllRead();
  return (
      <PopoverContent align="end" className="w-[22rem] p-0">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <h2 className="font-medium">{t('title')}</h2>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={markAll.isPending}
                onClick={() => markAll.mutate(undefined)}
              >
                {t('markAllRead')}
              </Button>
            )}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto overscroll-contain p-1.5">
            {items.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-text-muted">
                {pending ? t('loading') : t('empty')}
              </p>
            ) : (
              items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => onOpen(item.href)}
                />
              ))
            )}
          </div>
        </PopoverContent>
  );
}
