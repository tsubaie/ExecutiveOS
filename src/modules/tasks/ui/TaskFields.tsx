'use client';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
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
  const t = useTranslations('tasks');
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4">
      <Field label={t('title')}>
        <Input
          name="title"
          dir="auto"
          defaultValue={initial?.title ?? ''}
          required
          maxLength={500}
          onBlur={(event) => {
            const title = event.target.value.trim();
            if (title && title !== initial?.title) save?.({ title });
          }}
        />
      </Field>
      <TaskProperties initial={initial} save={save} />
      <Field label={t('description')}>
        <Textarea
          name="description"
          dir="auto"
          className="min-h-32"
          defaultValue={initial?.description ?? ''}
          maxLength={50000}
          onBlur={(event) => {
            const description = event.target.value || null;
            if (description !== initial?.description) save?.({ description });
          }}
        />
      </Field>
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
    <>
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
      <Field label={t('dueDate')}>
        <Input
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate ?? ''}
          onChange={(event) => save?.({ dueDate: event.target.value || null })}
        />
      </Field>
    </>
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
    <Field label={t('owner')}>
      <NativeSelect
        name="ownerId"
        aria-label={t('owner')}
        defaultValue={initial?.ownerId ?? ''}
        disabled={owners.isPending || Boolean(owners.error)}
        onChange={(event) => save?.({ ownerId: event.target.value || null })}
      >
        <NativeSelectOption value="">{t('unassigned')}</NativeSelectOption>
        {initial?.ownerId && !owners.data?.data.some((person) => person.id === initial.ownerId) && (
          <NativeSelectOption value={initial.ownerId}>{t('previousOwner')}</NativeSelectOption>
        )}
        {owners.data?.data.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.displayName ?? person.fullName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
