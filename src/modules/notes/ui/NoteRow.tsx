'use client';
import { useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { Avatar } from '@/ui/layout/Avatar';
import { cn } from '@/ui/cn';
import type { Note, Participant } from '../schema/validation';
import { useNoteTypes } from './queries';
import { useNoteDateLabel, useTypeLabel } from './use-note-labels';
// One line on a wide list: title, type and tags lead; task counts, participants and the date
// trail. On a phone the trailing group wraps under a two-line title and tags are hidden.
export function NoteRow({ note }: { note: Note }) {
  const t = useTranslations('notes');
  const types = useNoteTypes();
  const typeLabel = useTypeLabel(types.data?.data);
  const date = useNoteDateLabel()(note);
  const tasks = note.openTaskCount + note.doneTaskCount;
  return (
    <span className="grid min-w-0 flex-1 gap-1 sm:flex sm:items-center sm:gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="plaintext line-clamp-2 min-w-0 text-sm font-medium whitespace-normal sm:line-clamp-none sm:truncate sm:whitespace-nowrap">
          {note.title}
        </span>
        {note.type && <Chip>{typeLabel(note.type)}</Chip>}
        {note.archivedAt && <Chip tone="warning">{t('archivedChip')}</Chip>}
        {note.tags.length > 0 && (
          <span className="hidden shrink-0 gap-1 lg:flex">
            {note.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} tone="tag">
                {tag}
              </Chip>
            ))}
            {note.tags.length > 3 && <Chip tone="tag">+{note.tags.length - 3}</Chip>}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-text-muted tabular-nums">
        {tasks > 0 && (
          <span
            className="inline-flex items-center gap-1"
            title={t('taskCounts', { open: note.openTaskCount, done: note.doneTaskCount })}
          >
            <ListChecks className="size-3.5" aria-hidden />
            {t('taskCountsShort', { open: note.openTaskCount, done: note.doneTaskCount })}
          </span>
        )}
        <Participants participants={note.participants} />
        <time
          dateTime={note.noteDate}
          title={date.absolute}
          className={cn('min-w-16 text-end', date.tone === 'accent' && 'font-medium text-accent')}
        >
          {date.label}
        </time>
      </span>
    </span>
  );
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
        'max-w-32 shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] leading-tight font-semibold tracking-wide',
        tone === 'muted' && 'bg-surface-raised text-text-muted uppercase',
        tone === 'warning' && 'bg-warning-soft text-warning uppercase',
        tone === 'tag' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </span>
  );
}
// Up to three initials avatars, then a "+n" count; every name stays readable by assistive tech.
export function Participants({ participants }: { participants: Participant[] }) {
  const t = useTranslations('notes');
  if (!participants.length) return null;
  const shown = participants.slice(0, 3);
  return (
    <span className="flex items-center -space-x-1 rtl:space-x-reverse">
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} className="ring-2 ring-surface" />
      ))}
      {participants.length > shown.length && (
        <span className="ps-2 text-[10px]">
          {t('more', { count: participants.length - shown.length })}
        </span>
      )}
    </span>
  );
}
