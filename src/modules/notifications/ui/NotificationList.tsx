'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { PopoverContent } from '@/ui/primitives/popover';
import { useMarkAllRead } from './queries';
import type { Notification } from '../schema/validation';
import { NotificationRow } from './NotificationRow';
// The centre itself. NOTIF-B12: the empty state names the purpose and offers nothing, because
// there is no action a reader can take that creates a notification.
export function NotificationList({
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
            <NotificationRow key={item.id} item={item} onOpen={() => onOpen(item.href)} />
          ))
        )}
      </div>
    </PopoverContent>
  );
}
