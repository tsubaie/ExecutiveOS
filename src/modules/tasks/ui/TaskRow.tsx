'use client';
import { useTranslations } from 'next-intl';
import type { Task } from '../schema/validation';
import { cn } from '@/ui/cn';
export function TaskRow({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  return (
    <span className="grid min-w-0 flex-1 gap-2">
      <span
        dir="auto"
        className={cn(
          'truncate text-sm font-medium',
          task.status === 'completed' && 'text-text-muted line-through',
        )}
      >
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>{t(task.status)}</span>
        {task.priority && (
          <span className="rounded bg-surface-raised px-2 py-1">{t(task.priority)}</span>
        )}
        {task.dueDate && (
          <time
            dateTime={task.dueDate}
            title={task.dueDate}
            className={cn(task.band === 'overdue' && 'text-danger')}
          >
            {task.dueDate}
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
