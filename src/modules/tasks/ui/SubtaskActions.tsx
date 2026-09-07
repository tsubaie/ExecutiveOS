'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown } from 'lucide-react';
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
    <div className="mt-3 grid gap-2">
      {operation.error && <ErrorPanel error={operation.error} />}
      {!task.deletedAt && (
        <fieldset disabled={operation.pending || Boolean(parent.deletedAt)} className="grid gap-2">
          <SubtaskFields task={task} operation={operation} />
          <div className="flex flex-wrap items-center justify-between gap-1">
            <SubtaskOrdering task={task} parent={parent} operation={operation} />
            <Button size="sm" variant="ghost" onClick={() => setDeleting(true)}>
              {c('delete')}
            </Button>
          </div>
        </fieldset>
      )}
      {task.deletedOpId && !parent.deletedAt && (
        <Button
          size="sm"
          disabled={operation.pending}
          onClick={() =>
            void operation.run(() => mutations.restore(task.id, task.deletedOpId ?? ''))
          }
        >
          {c('restore')}
        </Button>
      )}
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogTitle>{c('delete')}</DialogTitle>
          <DialogDescription>{c('deleteDescription', { name: task.title })}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              {c('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={operation.pending}
              onClick={() =>
                void operation.run(
                  () => mutations.remove(task.id, task.revision),
                  () => setDeleting(false),
                )
              }
            >
              {c('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    <div className="grid grid-cols-2 gap-2">
      <NativeSelect
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
        value={task.dueDate ?? ''}
        onChange={(event) => void patch({ dueDate: event.target.value || null })}
      />
    </div>
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
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('moveUp')}
        disabled={index <= 0}
        onClick={() => reorder(-1)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('moveDown')}
        disabled={index >= length - 1}
        onClick={() => reorder(1)}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          void operation.run(() =>
            mutations.action(task.id, 'convert-to-task', { revision: task.revision }),
          )
        }
      >
        {t('convert')}
      </Button>
    </div>
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
