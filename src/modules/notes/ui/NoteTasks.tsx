'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CirclePlus, Link2, Unlink } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Checkbox } from '@/ui/primitives/checkbox';
import { ChoiceSelect, type Choice } from '@/ui/layout/ChoiceSelect';
import { Avatar } from '@/ui/layout/Avatar';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { usePlainDate } from '@/ui/format';
import { routes } from '@/core/routes';
import { useTaskMutations, useTasks } from '@/modules/tasks/ui';
import { TaskCreate } from '@/modules/tasks/schema/validation';
import type { NoteDetail, NoteTask } from '../schema/validation';
type Run = (action: () => Promise<object>) => Promise<void>;
// NOTES-B09: open tasks first, completed collapsed under a count, an inline "+ Task" row and an
// "Attach task" picker over open top-level tasks that have no note yet.
export function NoteTasks({ note }: { note: NoteDetail }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  const open = note.tasks.filter((task) => task.status !== 'completed');
  const done = note.tasks.filter((task) => task.status === 'completed');
  const run: Run = async (action) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    }
  };
  return (
    <section className="mt-6 border-t pt-4">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          {t('tasks')}
        </h3>
        {note.tasks.length > 0 && (
          <span className="text-xs text-text-muted tabular-nums">
            {t('taskCountsShort', { open: open.length, done: done.length })}
          </span>
        )}
      </div>
      {error && <ErrorPanel error={error} />}
      <ul className="divide-y border-y">
        {open.map((task) => (
          <TaskLine key={task.id} task={task} run={run} />
        ))}
      </ul>
      {done.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-text-muted">
            {t('completedTasks', { count: done.length })}
          </summary>
          <ul className="mt-1 divide-y border-y">
            {done.map((task) => (
              <TaskLine key={task.id} task={task} run={run} />
            ))}
          </ul>
        </details>
      )}
      {!note.deletedAt && <TaskActions note={note} run={run} />}
    </section>
  );
}
function TaskActions({ note, run }: { note: NoteDetail; run: Run }) {
  const t = useTranslations('notes');
  const mutations = useTaskMutations();
  const [attaching, setAttaching] = useState(false);
  return (
    <div className="mt-2 grid gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const title = String(new FormData(form).get('title') ?? '').trim();
          if (!title) return;
          void run(async () => {
            const task = await mutations.create(TaskCreate.parse({ title, sourceNoteId: note.id }));
            form.reset();
            return task ?? {};
          });
        }}
      >
        <CirclePlus className="size-4 shrink-0 text-text-muted" aria-hidden />
        <Input
          name="title"
          dir="auto"
          aria-label={t('taskTitle')}
          placeholder={t('addTask')}
          maxLength={500}
          className="h-8 text-sm"
        />
      </form>
      {attaching ? (
        <AttachTask note={note} run={run} done={() => setAttaching(false)} />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setAttaching(true)}
        >
          <Link2 className="size-3.5" />
          {t('attachTask')}
        </Button>
      )}
    </div>
  );
}
function TaskLine({ task, run }: { task: NoteTask; run: Run }) {
  const t = useTranslations('notes');
  const plainDate = usePlainDate();
  const mutations = useTaskMutations();
  const [pending, setPending] = useState(false);
  const completed = task.status === 'completed';
  const toggle = () => {
    setPending(true);
    void run(() =>
      mutations.action(task.id, completed ? 'reopen' : 'complete', { revision: task.revision }),
    ).finally(() => setPending(false));
  };
  return (
    <li className="flex min-h-10 items-center gap-2 py-1 text-sm">
      <Checkbox
        className="entity-check rounded-full"
        checked={pending ? !completed : completed}
        disabled={pending}
        aria-label={t(completed ? 'reopenNamed' : 'completeNamed', { name: task.title })}
        onCheckedChange={toggle}
      />
      <Link
        href={routes.tasks({ view: completed ? 'completed' : 'all', id: task.id })}
        className={
          completed
            ? 'min-w-0 flex-1 truncate text-text-muted line-through'
            : 'min-w-0 flex-1 truncate'
        }
      >
        <bdi>{task.title}</bdi>
      </Link>
      {task.ownerName && <Avatar name={task.ownerName} />}
      {task.dueDate && (
        <time dateTime={task.dueDate} className="text-xs text-text-muted tabular-nums">
          {plainDate(task.dueDate)}
        </time>
      )}
      <button
        type="button"
        aria-label={t('detachNamed', { name: task.title })}
        className="flex size-8 items-center justify-center rounded-md text-text-muted hover:text-danger"
        onClick={() =>
          void run(() =>
            mutations.patch(task.id, task.revision, { sourceNoteId: null }, crypto.randomUUID()),
          )
        }
      >
        <Unlink className="size-3.5" />
      </button>
    </li>
  );
}
// Mounted on demand so the eligible-task query only runs when the picker is open.
function AttachTask({ note, run, done }: { note: NoteDetail; run: Run; done: () => void }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const eligible = useTasks({
    view: 'all',
    q: '',
    sort: '',
    hasSourceNote: 'false',
    hasSubtasks: 'false',
  });
  const items: Choice[] = [
    { value: '', text: t('attachTask'), label: t('attachTask') },
    ...eligible.items.map((task) => ({ value: task.id, text: task.title, label: task.title })),
  ];
  return (
    <div className="flex items-center gap-2">
      <ChoiceSelect
        items={items}
        value=""
        label={t('attachTask')}
        size="sm"
        disabled={eligible.pending}
        onChange={(taskId) => {
          const task = eligible.items.find((item) => item.id === taskId);
          if (!task) return;
          void run(() =>
            mutations.patch(task.id, task.revision, { sourceNoteId: note.id }, crypto.randomUUID()),
          ).then(done);
        }}
      />
      <Button variant="ghost" size="sm" onClick={done}>
        {c('cancel')}
      </Button>
    </div>
  );
}
