'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown, CornerUpRight, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { Task, TaskDetail } from '../schema/validation';
import { useTaskMutations, useOwners } from './queries';
import { useTaskOperation } from './use-task-operation';
export function SubtaskActions({ task, parent }: { task: Task; parent: TaskDetail }) {
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const operation = useTaskOperation();
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="grid gap-1">
      {operation.error && <ErrorPanel error={operation.error} />}
      {!task.deletedAt && (
        <div className="hover-reveal-target">
          <fieldset
            disabled={operation.pending || Boolean(parent.deletedAt)}
            className="flex flex-wrap items-center gap-1 ps-8 pb-1"
          >
            <SubtaskFields task={task} operation={operation} />
            <span className="flex-1" />
            <SubtaskOrdering task={task} parent={parent} operation={operation} />
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-text-muted hover:text-danger"
              aria-label={c('delete')}
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </fieldset>
        </div>
      )}
      {task.deletedOpId && !parent.deletedAt && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1 ms-2 justify-self-start"
          disabled={operation.pending}
          onClick={() =>
            void operation.run(() => mutations.restore(task.id, task.deletedOpId ?? ''))
          }
        >
          {c('restore')}
        </Button>
      )}
      <SubtaskDeleteDialog
        task={task}
        open={deleting}
        setOpen={setDeleting}
        operation={operation}
      />
    </div>
  );
}
type Operation = ReturnType<typeof useTaskOperation>;
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
function SubtaskFields({ task, operation }: { task: Task; operation: Operation }) {
  const t = useTranslations('tasks');
  const owners = useOwners();
  const mutations = useTaskMutations();
  const patch = (fields: { ownerId?: string | null; dueDate?: string | null }) =>
    operation.run(() => mutations.patch(task.id, task.revision, fields, crypto.randomUUID()));
  return (
    <>
      <NativeSelect
        size="sm"
        className="w-32"
        aria-label={t('owner')}
        value={task.ownerId ?? ''}
        onChange={(event) => void patch({ ownerId: event.target.value || null })}
      >
        <NativeSelectOption value="">{t('unassigned')}</NativeSelectOption>
        {owners.data?.data.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.fullName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input
        aria-label={t('dueDate')}
        type="date"
        className="h-7 w-32 min-w-0 text-xs"
        value={task.dueDate ?? ''}
        onChange={(event) => void patch({ dueDate: event.target.value || null })}
      />
    </>
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
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t('moveUp')}
        disabled={index <= 0}
        onClick={() => reorder(-1)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t('moveDown')}
        disabled={index >= length - 1}
        onClick={() => reorder(1)}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t('convert')}
        title={t('convert')}
        onClick={() =>
          void operation.run(() =>
            mutations.action(task.id, 'convert-to-task', { revision: task.revision }),
          )
        }
      >
        <CornerUpRight className="size-4" />
      </Button>
    </>
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
