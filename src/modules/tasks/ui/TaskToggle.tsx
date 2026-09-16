'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useUndoToast } from '@/ui/layout/toast/use-undo-toast';
import { ApiError } from '@/core/http/client';
import type { Task } from '../schema/validation';
import { useTaskMutations } from './queries';
// TASKS-B02 completion, reduced to what the control actually needs, so surfaces that hold a task
// summary rather than a full task (the home page) reuse the behaviour instead of copying it.
export type Toggleable = {
  id: string;
  title: string;
  revision: number;
  completed: boolean;
  deleted?: boolean;
  // The toast names the kind of record that was completed, and a subtask is not a task to the
  // reader looking at a checklist inside one.
  subtask?: boolean;
};
// `onCompleted` is how the record's own detail panel steps aside once its task is done: completing
// takes the task out of every list view, so a panel left open strands it, turns read-only and grows
// the "outside the current view" banner — the framework reporting the reader's own action back to
// them. The subtask checklist passes nothing, because the parent being read is going nowhere.
export function TaskToggle({ task, onCompleted }: { task: Task; onCompleted?: (() => void) | undefined }) {
  return (
    <TaskCheck
      onCompleted={onCompleted}
      task={{
        id: task.id,
        title: task.title,
        revision: task.revision,
        completed: task.status === 'completed',
        deleted: Boolean(task.deletedAt),
        subtask: Boolean(task.parentId),
      }}
    />
  );
}
// TASKS-B02: completing is reversible, so it reports itself with an Undo that puts the task, and
// every subtask the same operation completed, back to the exact status each held. Reopening is the
// reader's own command in the other direction and carries no toast: it is not an undo, and it
// deliberately lands on `next_action` rather than wherever the task came from.
export function TaskCheck({ task, onCompleted }: { task: Toggleable; onCompleted?: (() => void) | undefined }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const undoToast = useUndoToast();
  const [pending, setPending] = useState(false);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  async function complete(force: boolean) {
    const { meta } = await mutations.complete(task.id, task.revision, force);
    // The panel goes first, so the receipt lands on the list rather than across the panel's edge.
    onCompleted?.();
    undoToast({
      message:
        force && openCount
          ? t('completedWithSubtasksToast', { count: openCount })
          : t(task.subtask ? 'subtaskCompletedToast' : 'completedToast'),
      undo: async () => {
        await mutations.undoComplete(task.id, meta.opId);
      },
    });
  }
  async function toggle(force = false) {
    setPending(true);
    setError(null);
    try {
      if (task.completed) await mutations.action(task.id, 'reopen', { revision: task.revision });
      else await complete(force);
      setOpenCount(null);
    } catch (error) {
      const details = completionDetails(error);
      if (details?.success) setOpenCount(details.data.openSubtasks);
      else setError(error instanceof Error ? error : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  if (task.deleted) return null;
  return (
    <>
      <Checkbox
        className="entity-check rounded-full"
        checked={pending ? !task.completed : task.completed}
        disabled={pending}
        aria-label={t(task.completed ? 'reopenNamed' : 'completeNamed', { name: task.title })}
        onCheckedChange={() => void toggle()}
      />
      {error && <ErrorPanel error={error} />}
      <CascadeDialog
        openCount={openCount}
        pending={pending}
        cancel={() => setOpenCount(null)}
        confirm={() => void toggle(true)}
      />
    </>
  );
}
// TASKS-A03: the one confirmation that stays, because it authorizes a cascade across records the
// reader cannot see from here. What it authorizes is still one operation, and still undoable from
// the toast that follows it.
function CascadeDialog({
  openCount,
  pending,
  cancel,
  confirm,
}: {
  openCount: number | null;
  pending: boolean;
  cancel: () => void;
  confirm: () => void;
}) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  return (
    <Dialog
      open={openCount !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent>
        <DialogTitle>{t('completeParent')}</DialogTitle>
        <DialogDescription>{t('openChildren', { count: openCount ?? 0 })}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={cancel}>
            {c('cancel')}
          </Button>
          <Button disabled={pending} onClick={confirm}>
            {t('completeAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function completionDetails(error: unknown) {
  return error instanceof ApiError
    ? z.object({ openSubtasks: z.number() }).safeParse(error.details)
    : null;
}
