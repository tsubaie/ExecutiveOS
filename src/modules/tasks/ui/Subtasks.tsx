'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { TaskCreate, type TaskDetail, type Task } from '../schema/validation';
import { TaskToggle } from './TaskToggle';
import { useTaskMutations } from './queries';
import { SubtaskActions } from './SubtaskActions';
// A checklist: toggle and title on the line, owner, date and ordering revealed under it on hover
// or focus (always on touch), and an inline row to add the next one (TASKS-B08).
export function Subtasks({ task }: { task: TaskDetail }) {
  const t = useTranslations('tasks');
  if (task.parentId) return null;
  const done = task.subtasks.filter((child) => child.status === 'completed').length;
  return (
    <section className="mt-6 border-t pt-4">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          {t('subtasks')}
        </h3>
        {task.subtasks.length > 0 && (
          <span className="text-xs text-text-muted tabular-nums">
            {t('progressShort', { done, total: task.subtasks.length })}
          </span>
        )}
      </div>
      <ul className="divide-y border-y">
        {task.subtasks.map((child) => (
          <li key={child.id} className="hover-reveal py-1">
            <SubtaskTitle task={child} />
            <SubtaskActions task={child} parent={task} />
          </li>
        ))}
      </ul>
      <DeletedSubtasks task={task} />
      {!task.deletedAt && task.status !== 'completed' && <AddSubtask parent={task} />}
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
      <div className="-ms-2.5 flex items-center gap-1">
        <TaskToggle task={task} />
        <Input
          dir="auto"
          aria-label={t('subtaskTitle')}
          defaultValue={task.title}
          disabled={Boolean(task.deletedAt)}
          maxLength={500}
          className={
            task.status === 'completed'
              ? 'plaintext border-transparent px-2 text-text-muted line-through hover:border-border'
              : 'plaintext border-transparent px-2 hover:border-border'
          }
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
        <details className="my-3">
          <summary className="cursor-pointer text-xs text-text-muted">{c('trash')}</summary>
          <ul className="mt-2 divide-y border-y">
            {task.deletedSubtasks.map((child) => (
              <li key={child.id} className="py-2">
                <bdi className="plaintext block px-2 text-sm text-text-muted">{child.title}</bdi>
                <SubtaskActions task={child} parent={task} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function AddSubtask({ parent }: { parent: TaskDetail }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  async function create(form: HTMLFormElement) {
    setPending(true);
    try {
      await mutations.create(
        TaskCreate.parse({ title: new FormData(form).get('title'), parentId: parent.id }),
      );
      form.reset();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {error && <ErrorPanel error={error} />}
      <form
        className="mt-1 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create(event.currentTarget);
        }}
      >
        <Plus className="ms-3.5 size-4 shrink-0 text-text-muted" aria-hidden />
        <Input
          name="title"
          dir="auto"
          aria-label={t('subtaskTitle')}
          placeholder={t('addSubtask')}
          className="border-transparent px-2 hover:border-border"
          required
          maxLength={500}
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {c('create')}
        </Button>
      </form>
    </>
  );
}
