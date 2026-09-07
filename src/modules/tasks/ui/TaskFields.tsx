'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TaskTitle, TaskDescription, useTaskText } from './TaskTextFields';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Property } from '@/ui/layout/Property';
import type { TaskCreate, Task, TaskPatch } from '../schema/validation';
import { useOwners } from './queries';
import { StatusSelect, PrioritySelect, OwnerSelect, DueDateField } from './TaskPickers';
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
      <TaskProperties key={propertyKey(initial)} initial={initial} save={save} />
      <TaskDescription editor={editor} />
    </fieldset>
  );
}

type Properties = {
  status: Task['status'];
  priority: NonNullable<Task['priority']> | '';
  ownerId: string;
  dueDate: string | null;
};
const propertiesOf = (initial: Initial | undefined): Properties => ({
  status: initial?.status ?? 'inbox',
  priority: initial?.priority ?? '',
  ownerId: initial?.ownerId ?? '',
  dueDate: initial?.dueDate ?? null,
});
const propertyKey = (initial: Initial | undefined) =>
  Object.values(propertiesOf(initial)).join('|');
// Pickers are controlled from a draft; the parent remounts this block whenever the saved task
// changes so the draft always starts from server truth. In the create form the draft is the form
// state and hidden inputs carry it into FormData.
function TaskProperties({
  initial,
  save,
}: {
  initial: Initial | undefined;
  save: ((patch: Patch) => void) | undefined;
}) {
  const t = useTranslations('tasks');
  const owners = useOwners();
  const [draft, setDraft] = useState(() => propertiesOf(initial));
  // A picker reporting the value it already shows is not an edit and must never write.
  const same = (patch: Partial<Properties>) =>
    (patch.status === undefined || patch.status === draft.status) &&
    (patch.priority === undefined || patch.priority === draft.priority) &&
    (patch.ownerId === undefined || patch.ownerId === draft.ownerId) &&
    (patch.dueDate === undefined || patch.dueDate === draft.dueDate);
  const change = (patch: Partial<Properties>, saved: Patch) => {
    if (same(patch)) return;
    setDraft((current) => ({ ...current, ...patch }));
    save?.(saved);
  };
  return (
    <div className="grid gap-2">
      <Property label={t('status')}>
        <StatusSelect
          name="status"
          value={draft.status}
          onChange={(next) => next !== 'completed' && change({ status: next }, { status: next })}
        />
      </Property>
      <Property label={t('priority')}>
        <PrioritySelect
          name="priority"
          value={draft.priority}
          onChange={(next) => change({ priority: next }, { priority: next || null })}
        />
      </Property>
      <div className="min-w-0">
        <Property label={t('owner')}>
          <OwnerSelect
            name="ownerId"
            value={draft.ownerId}
            people={owners.data?.data ?? []}
            disabled={owners.isPending || Boolean(owners.error)}
            onChange={(next) => change({ ownerId: next }, { ownerId: next || null })}
          />
        </Property>
        {owners.error && <ErrorPanel error={owners.error} retry={() => void owners.refetch()} />}
      </div>
      <Property label={t('dueDate')}>
        <DueDateField
          name="dueDate"
          value={draft.dueDate}
          onChange={(next) => change({ dueDate: next }, { dueDate: next })}
        />
      </Property>
    </div>
  );
}
