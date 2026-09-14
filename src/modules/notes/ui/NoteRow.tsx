'use client';
import { CommitteeChip } from '@/modules/committees/ui';
import { useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { PersonAvatar } from '@/ui/layout/PersonAvatar';
import { cn } from '@/ui/cn';
import type { Note, Participant } from '../schema/validation';
import { useNoteTypes } from './queries';
import { useNoteDateLabel, useTypeLabel } from './use-note-labels';
// NOTES-B02: compact cards prioritize the title; tags and participants remain in details.
export function NoteRow({ note }: { note: Note }) {
  return <span className="flex min-w-0 flex-1 items-center gap-3">
    <span aria-hidden={true} className="size-2 shrink-0 rounded-full bg-text-muted/60" />
    <span className="plaintext line-clamp-2 min-w-0 text-sm leading-relaxed font-medium whitespace-normal">{note.title}</span>
  </span>;
}
export function NoteTrail({ note }: { note: Note }) {
  const t = useTranslations('notes');
  const types = useNoteTypes();
  const typeLabel = useTypeLabel(types.data?.data);
  const date = useNoteDateLabel()(note);
  const tasks = note.openTaskCount + note.doneTaskCount;
  return <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-muted @lg:gap-3">
    {note.committee && <CommitteeChip committee={note.committee} />}
    {note.type && <Chip>{typeLabel(note.type)}</Chip>}
    {note.archivedAt && <Chip tone="warning">{t('archivedChip')}</Chip>}
    {tasks > 0 && <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-surface-raised/60 px-2 py-1 tabular-nums', note.openTaskCount === 0 && 'text-success')}
      title={t('taskCounts', { open: note.openTaskCount, done: note.doneTaskCount })}>
      <ListChecks className="size-3.5" aria-hidden />
      <progress className="h-1 w-8 accent-accent" value={note.doneTaskCount} max={tasks}
        aria-label={t('taskCounts', { open: note.openTaskCount, done: note.doneTaskCount })} />
      {note.doneTaskCount}/{tasks}
    </span>}
    <time dateTime={note.noteDate} title={date.absolute} className="whitespace-nowrap tabular-nums">{date.label}</time>
  </span>;
}
export function Chip({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'warning' | 'tag';
}) {
  return (
    <span
      className={cn(
        'max-w-32 shrink-0 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-normal',
        tone === 'muted' && 'bg-surface-raised/60 text-text-muted',
        tone === 'warning' && 'bg-warning-soft text-warning uppercase',
        tone === 'tag' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </span>
  );
}
// Beside the row (EP-B20): up to three initials avatars that reveal the full name when pressed,
// exactly as the owner avatar on a task row, then a "+n" count.
export function ParticipantsTrail({ participants }: { participants: Participant[] }) {
  const t = useTranslations('notes');
  if (!participants.length) return null;
  const shown = participants.slice(0, 3);
  return (
    <span className="flex items-center -space-x-1 rtl:space-x-reverse">
      {shown.map((person) => (
        <PersonAvatar key={person.id} name={person.name} className="ring-2 ring-surface" />
      ))}
      {participants.length > shown.length && (
        <span className="ps-2 text-[10px] text-text-muted">
          {t('more', { count: participants.length - shown.length })}
        </span>
      )}
    </span>
  );
}
