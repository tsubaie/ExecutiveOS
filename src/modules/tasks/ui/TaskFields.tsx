'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { TaskTitle, TaskDescription, useTaskText } from './TaskTextFields';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
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
// `heading` renders the title as the panel heading with `leading` (the completion toggle) beside
// it; the create form keeps a labelled title field.
export function TaskFields({
  initial,
  save,
  disabled = false,
  heading = false,
  leading,
}: {
  initial?: Initial;
  save?: (patch: Patch) => void;
  disabled?: boolean;
  heading?: boolean;
  leading?: ReactNode;
}) {
  const editor = useTaskText(
    { title: initial?.title ?? '', description: initial?.description ?? '' },
    save,
  );
  return (
    <fieldset
      disabled={disabled}
      data-autosave={save ? true : undefined}
      className="grid min-w-0 gap-4"
    >
      {heading ? (
        <div className="flex items-start gap-1">
          {leading && <span className="-ms-2.5 -mt-1 shrink-0">{leading}</span>}
          <div className="min-w-0 flex-1">
            <TaskTitle editor={editor} heading />
          </div>
        </div>
      ) : (
        <TaskTitle editor={editor} />
      )}
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
    <div className="grid gap-2">
      <Property label={t('status')}>
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
      </Property>
      <Property label={t('priority')}>
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
      </Property>
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
  // The select is uncontrolled, so it remounts when the people list arrives; otherwise a cold
  // load rendered before the query resolved kept showing "Unassigned" for an assigned task.
  const key = `${initial?.ownerId ?? ''}:${owners.data ? 'loaded' : 'pending'}`;
  return (
    <div className="min-w-0">
      <Property label={t('owner')}>
        <NativeSelect
          name="ownerId"
          aria-label={t('owner')}
          key={key}
          defaultValue={initial?.ownerId ?? ''}
          disabled={owners.isPending || Boolean(owners.error)}
          onChange={(event) => save?.({ ownerId: event.target.value || null })}
        >
          <OwnerOptions ownerId={initial?.ownerId ?? null} people={owners.data?.data ?? []} />
        </NativeSelect>
      </Property>
      {owners.error && <ErrorPanel error={owners.error} retry={() => void owners.refetch()} />}
    </div>
  );
}

// A previous owner who is no longer assignable stays selectable until the user changes it.
function OwnerOptions({
  ownerId,
  people,
}: {
  ownerId: string | null;
  people: { id: string; displayName: string | null; fullName: string }[];
}) {
  const t = useTranslations('tasks');
  return (
    <>
      <NativeSelectOption value="">{t('unassigned')}</NativeSelectOption>
      {ownerId && !people.some((person) => person.id === ownerId) && (
        <NativeSelectOption value={ownerId}>{t('previousOwner')}</NativeSelectOption>
      )}
      {people.map((person) => (
        <NativeSelectOption key={person.id} value={person.id}>
          {person.displayName ?? person.fullName}
        </NativeSelectOption>
      ))}
    </>
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
    <Property label={t('dueDate')}>
      <Input
        name="dueDate"
        type="date"
        defaultValue={initial?.dueDate ?? ''}
        onBlur={(event) => {
          if (event.target.validity.valid && event.target.value !== (initial?.dueDate ?? ''))
            save?.({ dueDate: event.target.value || null });
        }}
      />
    </Property>
  );
}

// A property reads label, then value, on one line; the control keeps its accessible label.
function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      {children}
    </label>
  );
}
