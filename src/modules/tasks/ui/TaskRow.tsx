'use client';
import { useTranslations } from 'next-intl';
import { usePlainDate } from '@/ui/format';
import type { Task } from '../schema/validation';
import { cn } from '@/ui/cn';
export function TaskRow({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  const plainDate = usePlainDate();
  const date = task.dueDate ? plainDate(task.dueDate) : null;
  return (
    <span className="grid min-w-0 flex-1 gap-2">
      <span
        dir="auto"
        className={cn(
          'line-clamp-2 whitespace-normal text-sm font-medium',
          task.status === 'completed' && 'text-text-muted line-through',
        )}
      >
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>{t(task.status)}</span>
        <TaskPriority priority={task.priority} />
        {task.dueDate && (
          <time
            dateTime={task.dueDate}
            title={date ?? undefined}
            className={cn(task.band === 'overdue' && 'text-danger')}
          >
            {task.band === 'today' ? t('today') : date}
          </time>
        )}
        {task.ownerName && <bdi className="max-w-36 truncate">{task.ownerName}</bdi>}
        {task.subtaskCount > 0 && (
          <span>
            {t('progress', { done: task.completedSubtaskCount, total: task.subtaskCount })}
          </span>
        )}
      </span>
    </span>
  );
}

function TaskPriority({ priority }: { priority: Task['priority'] }) {
  const t = useTranslations('tasks');
  if (!priority) return null;
  return (
    <span
      className={cn(
        'rounded bg-surface-raised px-2 py-1',
        priority === 'urgent' && 'text-danger',
        priority === 'high' && 'text-warning',
      )}
    >
      {t(priority)}
    </span>
  );
}
