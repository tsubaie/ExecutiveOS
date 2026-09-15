'use client';
import { useTranslations } from 'next-intl';
import { CommitteeChip } from '@/modules/committees/ui';
import { PersonAvatar } from '@/ui/layout/PersonAvatar';
import { cn } from '@/ui/cn';
import type { Column } from '@/ui/entity/types';
import type { Task } from '../schema/validation';
import { useDueLabel } from './use-due-label';
// EP-B29: the same facts the card carries, in columns. A card reads them as one sentence about a
// task; a table reads each of them down its own column, which is what a list of forty is scanned
// for. The cells are components rather than inline renderers so the shape of the table stays
// readable as a list of what it holds.
function TitleCell({ task }: { task: Task }) {
  return (
    <span
      className={cn(
        'plaintext line-clamp-2 font-medium',
        task.status === 'completed' && 'text-text-muted line-through',
      )}
    >
      {task.title}
    </span>
  );
}
function OwnerCell({ task }: { task: Task }) {
  if (!task.ownerName) return null;
  return (
    <span className="flex items-center gap-2">
      <PersonAvatar name={task.ownerName} />
      <span className="truncate">{task.ownerName}</span>
    </span>
  );
}
function DueCell({ task }: { task: Task }) {
  const label = useDueLabel()(task);
  if (!label || !task.dueDate) return null;
  return (
    <time
      dateTime={task.dueDate}
      title={label.absolute}
      className={cn(
        'whitespace-nowrap',
        label.tone === 'danger' && 'font-medium text-danger',
        label.tone === 'accent' && 'font-medium text-accent',
      )}
    >
      {label.label}
    </time>
  );
}
export function useTaskColumns(): Column<Task>[] {
  const t = useTranslations('tasks');
  return [
    {
      key: 'title',
      head: t('title'),
      primary: true,
      sort: 'title',
      cell: (task) => <TitleCell task={task} />,
    },
    { key: 'status', head: t('status'), cell: (task) => t(task.status) },
    {
      key: 'priority',
      head: t('priority'),
      sort: 'priority',
      cell: (task) => task.priority && t(task.priority),
    },
    { key: 'owner', head: t('owner'), cell: (task) => <OwnerCell task={task} /> },
    {
      key: 'due',
      head: t('dueDate'),
      numeric: true,
      sort: 'due_date',
      cell: (task) => <DueCell task={task} />,
    },
    {
      key: 'subtasks',
      head: t('subtasks'),
      numeric: true,
      cell: (task) =>
        task.subtaskCount > 0 &&
        t('progressShort', { done: task.completedSubtaskCount, total: task.subtaskCount }),
    },
    {
      key: 'committee',
      head: t('committeeColumn'),
      cell: (task) => task.committee && <CommitteeChip committee={task.committee} />,
    },
  ];
}
