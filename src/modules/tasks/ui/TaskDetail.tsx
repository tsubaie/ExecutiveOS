'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
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
      <div className="mb-5 flex items-start gap-3">
        <TaskToggle task={task} />
        <h2 tabIndex={-1} dir="auto" className="min-w-0 break-words text-xl font-semibold">
          {task.title}
        </h2>
      </div>
      {task.ownerId && (
        <Link href={`/people?id=${task.ownerId}`} className="mb-4 block text-sm text-accent">
          <bdi>{task.ownerName ?? t('owner')}</bdi>
        </Link>
      )}
      {task.deletedAt ? (
        <Button onClick={api.restore}>{c('restore')}</Button>
      ) : (
        <>
          {task.status === 'completed' && (
            <p className="mb-4 text-sm text-text-muted">{t('completedHint')}</p>
          )}
          <TaskFields initial={task} save={api.save} disabled={task.status === 'completed'} />
        </>
      )}
      <Subtasks task={task} />
      {!task.deletedAt && (
        <div className="mt-6 border-t pt-4">
          <Button variant="ghost" className="text-danger" onClick={api.remove}>
            {c('delete')}
          </Button>
        </div>
      )}
      <p className="mt-6 text-xs text-text-muted">
        {t('updated', { date: task.updatedAt.slice(0, 10) })}
      </p>
    </div>
  );
}
