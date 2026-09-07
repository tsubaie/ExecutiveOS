'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { CreateApi } from '@/ui/entity/types';
import { TaskCreate, type TaskDetail } from '../schema/validation';
import { TaskFields } from './TaskFields';
export function CreateTask({ api }: { api: CreateApi<TaskCreate, TaskDetail> }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.submit(
        TaskCreate.parse({
          ...fields,
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
    <form className="grid gap-5 p-5" onSubmit={(event) => void submit(event)}>
      <h2 tabIndex={-1} className="text-xl font-semibold">
        {t('newTask')}
      </h2>
      {error && <ErrorPanel error={error} />}
      <TaskFields />
      <div className="flex gap-2">
        <Button type="submit" disabled={api.pending}>
          {c('create')}
        </Button>
        <Button variant="outline" onClick={api.cancel}>
          {c('cancel')}
        </Button>
      </div>
    </form>
  );
}
