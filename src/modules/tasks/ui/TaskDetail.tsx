'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Trash2, NotebookPen } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { useDateTime, useRelativeTime } from '@/ui/format';
import { routes } from '@/core/routes';
import type { DetailApi } from '@/ui/entity/types';
import type { TaskDetail as Detail, TaskPatch } from '../schema/validation';
import { TaskFields } from './TaskFields';
import { TaskToggle } from './TaskToggle';
import { Subtasks } from './Subtasks';
export function TaskDetail({
  task,
  api,
}: {
  task: Detail;
  api: DetailApi<Omit<TaskPatch, 'revision'>>;
}) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  return (
    <div className="min-w-0">
      {task.deletedAt ? (
        <>
          <h2 tabIndex={-1} dir="auto" className="plaintext text-xl font-semibold">
            {task.title}
          </h2>
          <Button className="mt-4" onClick={api.restore}>
            {c('restore')}
          </Button>
        </>
      ) : (
        <>
          {task.status === 'completed' && (
            <p className="mb-3 text-xs text-text-muted">{t('completedHint')}</p>
          )}
          <TaskFields
            initial={task}
            save={api.save}
            disabled={task.status === 'completed'}
            heading
            leading={<TaskToggle task={task} />}
          />
        </>
      )}
      <Subtasks task={task} />
      <TaskFooter task={task} remove={api.remove} />
    </div>
  );
}

// Owner link and freshness at the start, the destructive action at the end, out of the way of
// the fields but still one click away.
function TaskFooter({ task, remove }: { task: Detail; remove: () => void }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const dateTime = useDateTime();
  const relative = useRelativeTime();
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-xs text-text-muted">
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {task.ownerId && (
          <Link href={routes.person(task.ownerId)} className="text-accent">
            <bdi>{task.ownerName ?? t('owner')}</bdi>
          </Link>
        )}
        {task.sourceNote && (
          <Link
            href={routes.notes({
              view: task.sourceNote.deletedAt ? 'trash' : 'all',
              id: task.sourceNote.id,
            })}
            className="inline-flex min-w-0 items-center gap-1 text-accent"
          >
            <NotebookPen className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {task.sourceNote.deletedAt ? t('noteTrashed') : task.sourceNote.title}
            </span>
          </Link>
        )}
        <span title={dateTime(task.updatedAt)}>
          {t('updated', { date: relative(task.updatedAt) })}
        </span>
      </span>
      {!task.deletedAt && (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={remove}
        >
          <Trash2 className="size-3.5" />
          {c('delete')}
        </Button>
      )}
    </footer>
  );
}
