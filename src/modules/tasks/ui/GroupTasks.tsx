'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { TaskDetail } from '../schema/validation';
import { useTaskMutations } from './queries';
export function GroupTasks({ items, clear }: { items: TaskDetail[]; clear: () => void }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mutations = useTaskMutations();
  async function group(title: string) {
    setPending(true);
    try {
      await mutations.group(
        title,
        items.map((item) => item.id),
      );
      clear();
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>{t('selected', { count: items.length })}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={items.length < 2}
          onClick={() => setOpen(true)}
        >
          {t('group')}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t('group')}</DialogTitle>
          <DialogDescription>{t('groupDescription')}</DialogDescription>
          {error && <ErrorPanel error={error} />}
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void group(String(new FormData(event.currentTarget).get('title') ?? ''));
            }}
          >
            <Input name="title" aria-label={t('title')} required maxLength={500} />
            <Button type="submit" disabled={pending}>
              {t('group')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
