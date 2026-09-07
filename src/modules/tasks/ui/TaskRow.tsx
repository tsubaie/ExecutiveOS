'use client';
import { useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { Avatar } from '@/ui/layout/Avatar';
import { cn } from '@/ui/cn';
import type { Task } from '../schema/validation';
import { useDueLabel } from './use-due-label';
// One line on a wide list: title and priority lead, subtask progress, owner and due date trail.
// On a phone the trailing group wraps under a two-line title.
export function TaskRow({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  const due = useDueLabel()(task);
  const completed = task.status === 'completed';
  return (
    <span className="grid min-w-0 flex-1 gap-1 sm:flex sm:items-center sm:gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'plaintext line-clamp-2 min-w-0 text-sm font-medium whitespace-normal sm:line-clamp-none sm:truncate sm:whitespace-nowrap',
            completed && 'text-text-muted line-through',
          )}
        >
          {task.title}
        </span>
        <TaskPriority priority={task.priority} />
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-text-muted tabular-nums">
        {!completed && task.status !== 'next_action' && <span>{t(task.status)}</span>}
        {task.subtaskCount > 0 && (
          <span
            className="inline-flex items-center gap-1"
            title={t('progress', { done: task.completedSubtaskCount, total: task.subtaskCount })}
          >
            <ListChecks className="size-3.5" aria-hidden />
            {t('progressShort', { done: task.completedSubtaskCount, total: task.subtaskCount })}
          </span>
        )}
        {task.ownerName && <Avatar name={task.ownerName} />}
        {due && task.dueDate && (
          <time
            dateTime={task.dueDate}
            title={due.absolute}
            className={cn(
              'min-w-16 text-end',
              due.tone === 'danger' && 'font-medium text-danger',
              due.tone === 'accent' && 'font-medium text-accent',
            )}
          >
            {due.label}
          </time>
        )}
      </span>
    </span>
  );
}

// Only urgent and high carry a tint so the eye lands on what needs it; the rest stay quiet.
function TaskPriority({ priority }: { priority: Task['priority'] }) {
  const t = useTranslations('tasks');
  if (!priority) return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-tight font-semibold tracking-wide uppercase',
        priority === 'urgent' && 'bg-danger-soft text-danger',
        priority === 'high' && 'bg-warning-soft text-warning',
        (priority === 'medium' || priority === 'low') && 'bg-surface-raised text-text-muted',
      )}
    >
      {t(priority)}
    </span>
  );
}
