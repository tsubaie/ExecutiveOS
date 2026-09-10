'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { EntityActionDialog } from '@/ui/entity/EntityActionDialog';
import type { TaskDetail } from '../schema/validation';
import { useTaskMutations } from './queries';
export function canGroup(items: TaskDetail[]) {
  return (
    items.length >= 2 &&
    items.every((item) => !item.deletedAt && !item.parentId && item.subtaskCount === 0)
  );
}
// Rendered by the entity bulk bar; `finish(true)` clears the selection after a successful group.
export function GroupTasksDialog({
  items,
  finish,
}: {
  items: TaskDetail[];
  finish: (clearSelection: boolean) => void;
}) {
  const t = useTranslations('tasks');
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
      finish(true);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('group')));
    } finally {
      setPending(false);
    }
  }
  return (
    <EntityActionDialog
      title={t('group')}
      description={t('groupDescription')}
      submitLabel={t('group')}
      error={error}
      pending={pending}
      finish={finish}
      onSubmit={(form) => group(String(form.get('title') ?? ''))}
    >
      <Input name="title" aria-label={t('title')} required maxLength={500} />
    </EntityActionDialog>
  );
}
