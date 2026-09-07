'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, GripVertical } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { TaskCreate, type TaskDetail, type Task } from '../schema/validation';
import { TaskToggle } from './TaskToggle';
import { useTaskMutations } from './queries';
import { SubtaskActions } from './SubtaskActions';
import { useSubtaskReorder } from './use-subtask-drag';
import { cn } from '@/ui/cn';
// A checklist: toggle, title and an eye button that opens the subtask's details (owner, date,
// order, conversion, trash), plus an inline row to add the next one (TASKS-B08).
export function Subtasks({ task }: { task: TaskDetail }) {
  const t = useTranslations('tasks');
  const drag = useSubtaskReorder(task);
  const byId = new Map(task.subtasks.map((child) => [child.id, child]));
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
      {drag.error && <ErrorPanel error={drag.error} />}
      <ul className="divide-y border-y" onPointerMove={drag.move} onPointerUp={drag.end}>
        {drag.order.map((id) => {
          const child = byId.get(id);
          return child ? (
            <li
              key={child.id}
              ref={drag.register(child.id)}
              className={cn(
                'flex items-center gap-1 py-0.5 transition-colors',
                drag.dragging === child.id && 'bg-accent-soft',
              )}
            >
              <button
                type="button"
                aria-label={t('dragHandle')}
                disabled={Boolean(task.deletedAt) || drag.active.length < 2}
                className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-text-muted/70 hover:text-text active:cursor-grabbing disabled:opacity-30"
                onPointerDown={drag.start(child.id)}
              >
                <GripVertical className="size-4" />
              </button>
              <SubtaskTitle task={child} />
              <SubtaskActions task={child} parent={task} />
            </li>
          ) : null;
        })}
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
      <div className="-ms-2 flex min-w-0 flex-1 items-center gap-1">
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
              <li key={child.id} className="flex items-center gap-2 py-1.5">
                <bdi className="plaintext min-w-0 flex-1 truncate px-2 text-sm text-text-muted">
                  {child.title}
                </bdi>
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
