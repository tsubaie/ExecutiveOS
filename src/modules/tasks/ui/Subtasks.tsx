'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { TaskCreate, type TaskDetail, type Task } from '../schema/validation';
import { TaskToggle } from './TaskToggle';
import { useTaskMutations } from './queries';
import { SubtaskActions } from './SubtaskActions';
export function Subtasks({ task }: { task: TaskDetail }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  async function create(form: HTMLFormElement) {
    setPending(true);
    try {
      await mutations.create(
        TaskCreate.parse({ title: new FormData(form).get('title'), parentId: task.id }),
      );
      form.reset();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  if (task.parentId) return null;
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="mb-4 font-medium">{t('subtasks')}</h3>
      {error && <ErrorPanel error={error} />}
      <ul className="grid gap-3">
        {task.subtasks.map((child) => (
          <li key={child.id} className="rounded-lg border p-3">
            <SubtaskTitle task={child} />
            <SubtaskActions task={child} parent={task} />
          </li>
        ))}
      </ul>
      <DeletedSubtasks task={task} />
      {!task.deletedAt && task.status !== 'completed' && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create(event.currentTarget);
          }}
        >
          <Input
            name="title"
            dir="auto"
            aria-label={t('subtaskTitle')}
            placeholder={t('subtaskTitle')}
            required
            maxLength={500}
          />
          <Button type="submit" disabled={pending}>
            {c('create')}
          </Button>
        </form>
      )}
    </section>
  );
}
function SubtaskTitle({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const [error, setError] = useState<Error | null>(null);
  async function rename(title: string) {
    if (!title.trim() || title.trim() === task.title) return;
    try {
      await mutations.patch(task.id, task.revision, { title }, crypto.randomUUID());
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    }
  }
  return (
    <>
      <div className="flex items-center gap-3">
        <TaskToggle task={task} />
        <Input
          dir="auto"
          aria-label={t('subtaskTitle')}
          defaultValue={task.title}
          disabled={Boolean(task.deletedAt)}
          maxLength={500}
          onBlur={(event) => void rename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = task.title;
              event.currentTarget.blur();
              event.stopPropagation();
            }
          }}
        />
      </div>
      {error && <ErrorPanel error={error} />}
    </>
  );
}

function DeletedSubtasks({ task }: { task: TaskDetail }) {
  const c = useTranslations('common');
  return (
    <>
      {' '}
      {task.deletedSubtasks.length > 0 && (
        <details className="my-4">
          <summary className="cursor-pointer text-sm text-text-muted">{c('trash')}</summary>
          <ul className="mt-3 grid gap-3">
            {task.deletedSubtasks.map((child) => (
              <li key={child.id} className="rounded-lg border p-3">
                <bdi>{child.title}</bdi>
                <SubtaskActions task={child} parent={task} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
