'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { routes } from '@/core/routes';
import type { DetailApi } from '@/ui/entity/types';
import type { TaskDetail as Detail, TaskPatch } from '../schema/validation';
import { TaskFields } from './TaskFields';
import { useDueLabel } from './use-due-label';
import { TaskToggle } from './TaskToggle';
import { EntityFooter, EntityUpdated } from '@/ui/entity/EntityFooter';
import { TaskAi } from './TaskAi';
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
            dueNote={<TaskDue task={task} />}
            initial={task}
            save={api.save}
            disabled={task.status === 'completed'}
            heading
            leading={<TaskToggle task={task} onCompleted={api.close} />}
          />
        </>
      )}
      <TaskAi key={task.id} task={task} />
      <Subtasks task={task} />
      <TaskFooter task={task} remove={api.remove} />
    </div>
  );
}

// TASKS-B03: the row states how late a task is in words and the panel used to state it only as a
// red date, so the screen where the decision is made said less than the screen it was opened
// from. Both now read the same wording out of the same helper.
function TaskDue({ task }: { task: Detail }) {
  const due = useDueLabel()(task);
  if (!due || due.tone === 'muted') return null;
  return (
    <span
      className={`shrink-0 text-sm font-medium ${due.tone === 'danger' ? 'text-danger' : 'text-accent'}`}
    >
      {due.label}
    </span>
  );
}

// Owner link and freshness at the start, the destructive action at the end, out of the way of
// the fields but still one click away.
function TaskFooter({ task, remove }: { task: Detail; remove: () => void }) {
  const t = useTranslations('tasks');
  return (
    <EntityFooter remove={task.deletedAt ? null : remove}>
      <>
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
        <EntityUpdated at={task.updatedAt} />
      </>
    </EntityFooter>
  );
}
