'use client';
import { CommitteeChip } from '@/modules/committees/ui';
import { useTranslations } from 'next-intl';
import { ListChecks, NotebookPen } from 'lucide-react';
import { cn } from '@/ui/cn';
import type { Task } from '../schema/validation';
import { PersonAvatar } from '@/ui/layout/PersonAvatar';
import { useDueLabel } from './use-due-label';
// Task and note titles share the compact entity card, with task-specific metadata trailing.
export function TaskRow({ task }: { task: Task }) {
  return <span className="flex min-w-0 flex-1 items-center gap-2">
    <span className={cn('plaintext line-clamp-2 min-w-0 text-sm leading-relaxed font-medium whitespace-normal', task.status === 'completed' && 'text-text-muted line-through')}>
      {task.title}
    </span>
    <TaskPriority priority={task.priority} />
  </span>;
}
export function TaskTrail({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  const due = useDueLabel()(task);
  return <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-muted @lg:gap-3">
    {task.committee && <CommitteeChip committee={task.committee} />}
    {task.status !== 'next_action' && task.status !== 'completed' && <span className="rounded-full bg-surface-raised/60 px-2 py-1">{t(task.status)}</span>}
    {task.subtaskCount > 0 && <span className="inline-flex items-center gap-1 tabular-nums"
      title={t('progress', { done: task.completedSubtaskCount, total: task.subtaskCount })}>
      <ListChecks className="size-3.5" aria-hidden />
      {t('progressShort', { done: task.completedSubtaskCount, total: task.subtaskCount })}
    </span>}
    {task.sourceNote && <span className="hidden @2xl:inline-flex"><SourceNoteChip note={task.sourceNote} /></span>}
    {due && task.dueDate && <time dateTime={task.dueDate} title={due.absolute}
      className={cn('whitespace-nowrap tabular-nums', due.tone === 'danger' && 'font-medium text-danger', due.tone === 'accent' && 'font-medium text-accent')}>
      {due.label}
    </time>}
    {task.ownerName && <PersonAvatar name={task.ownerName} />}
  </span>;
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
// The source note, reading "Note in trash" while that note is trashed (TASKS-B16).
function SourceNoteChip({ note }: { note: NonNullable<Task['sourceNote']> }) {
  const t = useTranslations('tasks');
  const label = note.deletedAt ? t('noteTrashed') : note.title;
  return (
    <span className="inline-flex max-w-28 items-center gap-1" title={label}>
      <NotebookPen className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
