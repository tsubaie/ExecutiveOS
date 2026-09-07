'use client';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { TaskTitle, TaskDescription, useTaskText } from './TaskTextFields';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { Field } from '@/ui/layout/Field';
import {
  OpenStatus,
  Priority,
  type TaskCreate,
  type Task,
  type TaskPatch,
} from '../schema/validation';
import { useOwners } from './queries';
type Patch = Omit<TaskPatch, 'revision'>;
type Initial = Partial<Omit<TaskCreate, 'status'>> & { status?: Task['status'] };
export function TaskFields({
  initial,
  save,
  disabled = false,
}: {
  initial?: Initial;
  save?: (patch: Patch) => void;
  disabled?: boolean;
}) {
  const editor = useTaskText(
    { title: initial?.title ?? '', description: initial?.description ?? '' },
    save,
  );
  return (
    <fieldset disabled={disabled} data-autosave={Boolean(save)} className="grid min-w-0 gap-4">
      <TaskTitle editor={editor} />
      <TaskProperties initial={initial} save={save} />
      <TaskDescription editor={editor} />
    </fieldset>
  );
}

function TaskProperties({
  initial,
  save,
}: {
  initial: Initial | undefined;
  save: ((patch: Patch) => void) | undefined;
}) {
  const t = useTranslations('tasks');
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label={t('status')}>
        <NativeSelect
          name="status"
          key={initial?.status}
          aria-label={t('status')}
          defaultValue={initial?.status ?? 'inbox'}
          onChange={(event) => save?.({ status: OpenStatus.parse(event.target.value) })}
        >
          {initial?.status === 'completed' && (
            <NativeSelectOption value="completed">{t('completed')}</NativeSelectOption>
          )}
          {OpenStatus.options.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {t(status)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t('priority')}>
        <NativeSelect
          name="priority"
          aria-label={t('priority')}
          key={initial?.priority ?? ''}
          defaultValue={initial?.priority ?? ''}
          onChange={(event) =>
            save?.({ priority: event.target.value ? Priority.parse(event.target.value) : null })
          }
        >
          <NativeSelectOption value="">{t('none')}</NativeSelectOption>
          {Priority.options.map((priority) => (
            <NativeSelectOption key={priority} value={priority}>
              {t(priority)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <TaskOwner initial={initial} save={save} />
      <TaskDate initial={initial} save={save} />
    </div>
  );
}

function TaskOwner({
  initial,
  save,
}: {
  initial: Initial | undefined;
  save: ((patch: Patch) => void) | undefined;
}) {
  const t = useTranslations('tasks');
  const owners = useOwners();
  return (
    <div className="min-w-0">
      <Field label={t('owner')}>
        <NativeSelect
          name="ownerId"
          aria-label={t('owner')}
          key={initial?.ownerId ?? ''}
          defaultValue={initial?.ownerId ?? ''}
          disabled={owners.isPending || Boolean(owners.error)}
          onChange={(event) => save?.({ ownerId: event.target.value || null })}
        >
          <NativeSelectOption value="">{t('unassigned')}</NativeSelectOption>
          {initial?.ownerId &&
            !owners.data?.data.some((person) => person.id === initial.ownerId) && (
              <NativeSelectOption value={initial.ownerId}>{t('previousOwner')}</NativeSelectOption>
            )}
          {owners.data?.data.map((person) => (
            <NativeSelectOption key={person.id} value={person.id}>
              {person.displayName ?? person.fullName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {owners.error && <ErrorPanel error={owners.error} retry={() => void owners.refetch()} />}
    </div>
  );
}

function TaskDate({
  initial,
  save,
}: {
  initial: Initial | undefined;
  save: ((patch: Patch) => void) | undefined;
}) {
  const t = useTranslations('tasks');
  return (
    <Field label={t('dueDate')}>
      <Input
        name="dueDate"
        type="date"
        defaultValue={initial?.dueDate ?? ''}
        onBlur={(event) => {
          if (event.target.validity.valid && event.target.value !== (initial?.dueDate ?? ''))
            save?.({ dueDate: event.target.value || null });
        }}
      />
    </Field>
  );
}
