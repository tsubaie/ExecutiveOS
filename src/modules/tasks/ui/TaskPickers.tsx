'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Inbox, Play, Clock, Moon, CheckCircle2, Flag, type LucideIcon } from 'lucide-react';
import { ChoiceSelect, type Choice } from '@/ui/layout/ChoiceSelect';
import { DatePicker } from '@/ui/layout/DatePicker';
import { Avatar } from '@/ui/layout/Avatar';
import { cn } from '@/ui/cn';
import { useToday } from '@/ui/format';
import { OpenStatus, Priority, type Task } from '../schema/validation';
type Size = 'sm' | 'default';
type Person = { id: string; displayName: string | null; fullName: string };
// Status and priority pickers show a coloured dot or a tinted flag before the label so state reads
// at a glance in the trigger and in the list (tasks.md § UI).
const statusIcons: Record<Task['status'], LucideIcon> = {
  inbox: Inbox,
  next_action: Play,
  waiting_on: Clock,
  someday: Moon,
  completed: CheckCircle2,
};
const statusTone: Record<Task['status'], string> = {
  inbox: 'bg-text-muted',
  next_action: 'bg-accent',
  waiting_on: 'bg-warning',
  someday: 'bg-text-muted/60',
  completed: 'bg-success',
};
const priorityTone: Record<NonNullable<Task['priority']>, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
  medium: 'text-accent',
  low: 'text-text-muted',
};
function Option({ dot, icon, children }: { dot?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {dot && <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
type PickerProps<V extends string> = {
  value: V;
  onChange?: (value: V) => void;
  name?: string;
  size?: Size;
};
export function StatusSelect({ value, onChange, name, size }: PickerProps<Task['status']>) {
  const t = useTranslations('tasks');
  const statuses: Task['status'][] =
    value === 'completed' ? ['completed', ...OpenStatus.options] : [...OpenStatus.options];
  const items: Choice<Task['status']>[] = statuses.map((status) => {
    const Icon = statusIcons[status];
    return {
      value: status,
      text: t(status),
      label: (
        <Option dot={statusTone[status]} icon={<Icon className="size-4 text-text-muted" />}>
          {t(status)}
        </Option>
      ),
    };
  });
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={t('status')}
      {...(name ? { name } : {})}
      {...(size ? { size } : {})}
      onChange={(next) => onChange?.(next)}
    />
  );
}
export function PrioritySelect({
  value,
  onChange,
  name,
  size,
}: PickerProps<NonNullable<Task['priority']> | ''>) {
  const t = useTranslations('tasks');
  const items: Choice<NonNullable<Task['priority']> | ''>[] = [
    { value: '', text: t('none'), label: <Option>{t('none')}</Option> },
    ...Priority.options.map((priority) => ({
      value: priority,
      text: t(priority),
      label: (
        <Option icon={<Flag className={cn('size-4', priorityTone[priority])} />}>
          {t(priority)}
        </Option>
      ),
    })),
  ];
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={t('priority')}
      {...(name ? { name } : {})}
      {...(size ? { size } : {})}
      onChange={(next) => onChange?.(next)}
    />
  );
}
// A previous owner who is no longer assignable stays selectable until the user changes it.
export function OwnerSelect({
  value,
  onChange,
  name,
  size,
  people,
  disabled = false,
}: PickerProps<string> & { people: Person[]; disabled?: boolean }) {
  const t = useTranslations('tasks');
  const known = people.some((person) => person.id === value);
  const items: Choice[] = [
    { value: '', text: t('unassigned'), label: <Option>{t('unassigned')}</Option> },
    ...(value && !known
      ? [{ value, text: t('previousOwner'), label: <Option>{t('previousOwner')}</Option> }]
      : []),
    ...people.map((person) => {
      const text = person.displayName ?? person.fullName;
      return {
        value: person.id,
        text,
        label: <Option icon={<Avatar name={text} className="size-5 text-[9px]" />}>{text}</Option>,
      };
    }),
  ];
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={t('owner')}
      disabled={disabled}
      {...(name ? { name } : {})}
      {...(size ? { size } : {})}
      onChange={(next) => onChange?.(next)}
    />
  );
}
// Due date with the same tone as the list label: overdue in danger, today in the accent.
export function DueDateField({
  value,
  onChange,
  name,
  size = 'default',
}: {
  value: string | null;
  onChange?: (value: string | null) => void;
  name?: string;
  size?: Size;
}) {
  const t = useTranslations('tasks');
  const today = useToday();
  const tone = !value ? 'muted' : value < today ? 'danger' : value === today ? 'accent' : 'muted';
  return (
    <DatePicker
      value={value}
      onChange={(next) => onChange?.(next)}
      label={t('dueDate')}
      tone={tone}
      size={size}
      {...(name ? { name } : {})}
    />
  );
}
