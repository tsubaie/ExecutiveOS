'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/ui/cn';
import { useDateTime } from '@/ui/format';
import { useMarkRead } from './queries';
import type { Notification } from '../schema/validation';
// NOTIF-B09: opening marks it read and goes to the subject. The line says what happened in a
// sentence the catalogue owns, so Arabic can order the actor and the record its own way.
export function NotificationRow({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const when = useDateTime();
  const read = useMarkRead();
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-auto w-full justify-start gap-2.5 px-2 py-2 text-start font-normal',
        !item.readAt && 'bg-accent-soft',
      )}
      onClick={() => {
        if (!item.readAt) read.mutate(item.id);
        onOpen();
      }}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        {/* The sentence is the notification; truncating it to one line hides which record it is
            about, which is the only thing the reader opened the centre to find out. */}
        <span className="line-clamp-2 text-sm whitespace-normal" dir="auto">
          <Sentence item={item} />
        </span>
        <span className="text-xs text-text-muted" title={item.createdAt}>
          {when(item.createdAt)}
        </span>
      </span>
    </Button>
  );
}
// Each kind names its own message key rather than one built from the kind at runtime. next-intl
// can check a literal key against the arguments it interpolates and cannot check a computed one,
// and these six sentences are exactly the place where a missing argument would show up as a
// half-written line in front of the reader. The keys carry no dots: a kind is `task.assigned`
// because that is what the database stores, but next-intl reads a dot as a path and the catalogue
// is two levels deep by audit (`scripts/audit/i18n.ts`).
function Sentence({ item }: { item: Notification }) {
  const t = useTranslations('notifications');
  // Only the two kinds someone caused name an actor; the clock and the scorecard are nobody, and
  // the compiler holds each sentence to the arguments its own message actually interpolates.
  const by = { actor: item.actorName ?? t('someone'), title: item.title };
  const about = { title: item.title };
  switch (item.kind) {
    case 'task.assigned':
      return t('taskAssigned', by);
    case 'note.mentioned':
      return t('noteMentioned', by);
    case 'task.due_today':
      return t('taskDueToday', about);
    case 'task.overdue':
      return t('taskOverdue', about);
    case 'kpi.off_target':
      return t('kpiOffTarget', about);
    case 'job.finished':
      return t('jobFinished', about);
  }
}
