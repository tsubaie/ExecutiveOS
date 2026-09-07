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
import { ApiError } from '@/core/http/client';
import type { Task } from '../schema/validation';
import { useTaskMutations } from './queries';
export function TaskToggle({ task }: { task: Task }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const [pending, setPending] = useState(false);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  async function toggle(force = false) {
    setPending(true);
    setError(null);
    try {
      await mutations.action(task.id, task.status === 'completed' ? 'reopen' : 'complete', {
        revision: task.revision,
        ...(task.status === 'completed' ? {} : { force }),
      });
      setOpenCount(null);
    } catch (error) {
      const details = completionDetails(error);
      if (details?.success) setOpenCount(details.data.openSubtasks);
      else setError(error instanceof Error ? error : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  if (task.deletedAt) return null;
  return (
    <>
      <Checkbox
        className="entity-check rounded-full"
        checked={task.status === 'completed'}
        disabled={pending}
        aria-label={t(task.status === 'completed' ? 'reopenNamed' : 'completeNamed', {
          name: task.title,
        })}
        onCheckedChange={() => void toggle()}
      />
      {error && <ErrorPanel error={error} />}
      <Dialog
        open={openCount !== null}
        onOpenChange={(open) => {
          if (!open) setOpenCount(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{t('completeParent')}</DialogTitle>
          <DialogDescription>{t('openChildren', { count: openCount ?? 0 })}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCount(null)}>
              {c('cancel')}
            </Button>
            <Button disabled={pending} onClick={() => void toggle(true)}>
              {t('completeAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function completionDetails(error: unknown) {
  return error instanceof ApiError
    ? z.object({ openSubtasks: z.number() }).safeParse(error.details)
    : null;
}
