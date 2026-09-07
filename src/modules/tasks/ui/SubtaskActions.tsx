'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown, CornerUpRight, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Property } from '@/ui/layout/Property';
import type { Task, TaskDetail } from '../schema/validation';
import { useTaskMutations, useOwners } from './queries';
import { useTaskOperation } from './use-task-operation';
import { OwnerSelect, DueDateField } from './TaskPickers';
// The eye button opens a dialog with the subtask's owner, due date, order, conversion and trash.
// A dialog rather than hover: the office works on tablets, where nothing hovers (TASKS-B08).
export function SubtaskActions({ task, parent }: { task: Task; parent: TaskDetail }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const operation = useTaskOperation();
  const [open, setOpen] = useState(false);
  if (task.deletedAt)
    return task.deletedOpId && !parent.deletedAt ? (
      <Button
        size="sm"
        variant="outline"
        disabled={operation.pending}
        onClick={() => void operation.run(() => mutations.restore(task.id, task.deletedOpId ?? ''))}
      >
        {c('restore')}
      </Button>
    ) : null;
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-text-muted"
        aria-label={t('subtaskDetails')}
        disabled={Boolean(parent.deletedAt)}
        onClick={() => setOpen(true)}
      >
        <Eye className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle dir="auto" className="plaintext pe-8">
            {task.title}
          </DialogTitle>
          <DialogDescription>{t('subtaskDetailsDescription')}</DialogDescription>
          {operation.error && <ErrorPanel error={operation.error} />}
          <SubtaskFields task={task} operation={operation} />
          <SubtaskOrdering task={task} parent={parent} operation={operation} />
        </DialogContent>
      </Dialog>
    </>
  );
}
type Operation = ReturnType<typeof useTaskOperation>;
function SubtaskFields({ task, operation }: { task: Task; operation: Operation }) {
  const t = useTranslations('tasks');
  const owners = useOwners();
  const mutations = useTaskMutations();
  const patch = (fields: { ownerId?: string | null; dueDate?: string | null }) =>
    operation.run(() => mutations.patch(task.id, task.revision, fields, crypto.randomUUID()));
  return (
    <fieldset disabled={operation.pending} className="grid gap-2">
      <Property label={t('owner')}>
        <OwnerSelect
          value={task.ownerId ?? ''}
          people={owners.data?.data ?? []}
          onChange={(ownerId) => {
            if ((ownerId || null) !== task.ownerId) void patch({ ownerId: ownerId || null });
          }}
        />
      </Property>
      <Property label={t('dueDate')}>
        <DueDateField
          value={task.dueDate}
          onChange={(dueDate) => {
            if (dueDate !== task.dueDate) void patch({ dueDate });
          }}
        />
      </Property>
    </fieldset>
  );
}
function SubtaskOrdering({
  task,
  parent,
  operation,
}: {
  task: Task;
  parent: TaskDetail;
  operation: Operation;
}) {
  const t = useTranslations('tasks');
  const mutations = useTaskMutations();
  const { index, length, reorder } = useSubtaskOrder(task, parent, operation);
  return (
    <DialogFooter className="flex-row flex-wrap items-center gap-1 sm:justify-start">
      <Button
        size="icon"
        variant="outline"
        aria-label={t('moveUp')}
        disabled={index <= 0 || operation.pending}
        onClick={() => reorder(-1)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        aria-label={t('moveDown')}
        disabled={index >= length - 1 || operation.pending}
        onClick={() => reorder(1)}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        variant="outline"
        disabled={operation.pending}
        onClick={() =>
          void operation.run(() =>
            mutations.action(task.id, 'convert-to-task', { revision: task.revision }),
          )
        }
      >
        <CornerUpRight className="size-4" />
        {t('convert')}
      </Button>
      <span className="flex-1" />
      <SubtaskDelete task={task} operation={operation} />
    </DialogFooter>
  );
}
function SubtaskDelete({ task, operation }: { task: Task; operation: Operation }) {
  const c = useTranslations('common');
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="text-danger hover:text-danger"
        disabled={operation.pending}
        onClick={() => setDeleting(true)}
      >
        <Trash2 className="size-4" />
        {c('delete')}
      </Button>
      <SubtaskDeleteDialog
        task={task}
        open={deleting}
        setOpen={setDeleting}
        operation={operation}
      />
    </>
  );
}
function SubtaskDeleteDialog({
  task,
  open,
  setOpen,
  operation,
}: {
  task: Task;
  open: boolean;
  setOpen: (open: boolean) => void;
  operation: Operation;
}) {
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{c('delete')}</DialogTitle>
        <DialogDescription>{c('deleteDescription', { name: task.title })}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {c('cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={operation.pending}
            onClick={() =>
              void operation.run(
                () => mutations.remove(task.id, task.revision),
                () => setOpen(false),
              )
            }
          >
            {c('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function movedIds(items: string[], index: number, direction: number) {
  const current = items[index];
  const other = items[index + direction];
  if (!current || !other) return null;
  items[index] = other;
  items[index + direction] = current;
  return items;
}

function useSubtaskOrder(task: Task, parent: TaskDetail, operation: Operation) {
  const mutations = useTaskMutations();
  const active = parent.subtasks.filter((child) => !child.deletedAt);
  const index = active.findIndex((child) => child.id === task.id);
  function reorder(direction: number) {
    const items = movedIds(
      active.map((child) => child.id),
      index,
      direction,
    );
    if (!items) return;
    void operation.run(() =>
      mutations.reorder(
        parent.id,
        items,
        Object.fromEntries(active.map((child) => [child.id, child.revision])),
      ),
    );
  }
  return { index, length: active.length, reorder };
}
