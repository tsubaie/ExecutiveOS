'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EntityCreateForm } from '@/ui/entity/EntityCreateForm';
import type { CreateApi } from '@/ui/entity/types';
import { TaskCreate, type TaskDetail } from '../schema/validation';
import { TaskFields } from './TaskFields';
export function CreateTask({ api, committeeId = null }: { api: CreateApi<TaskCreate, TaskDetail>; committeeId?: string | null }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  async function submit(form: FormData) {
    const fields = Object.fromEntries(form);
    try {
      await api.submit(
        TaskCreate.parse({
          ...fields,
          committeeId: fields.committeeId || null,
          priority: fields.priority || null,
          dueDate: fields.dueDate || null,
          ownerId: fields.ownerId || null,
          description: fields.description || null,
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    }
  }
  return (
    <EntityCreateForm
      title={t('newTask')}
      error={error}
      pending={api.pending}
      cancel={api.cancel}
      onSubmit={submit}
    >
      <TaskFields initial={{ committeeId }} />
    </EntityCreateForm>
  );
}
