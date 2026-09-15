'use client';
import { useTranslations } from 'next-intl';
import { CommitteeChip } from '@/modules/committees/ui';
import type { Column } from '@/ui/entity/types';
import type { Note } from '../schema/validation';
import { useNoteTypes } from './queries';
import { useNoteDateLabel, useTypeLabel } from './use-note-labels';
// EP-B29: a note's columns are what a reader files by — when it happened, what kind it is, whose
// committee it belongs to, and how much work came out of it.
export function useNoteColumns(): Column<Note>[] {
  const t = useTranslations('notes');
  const types = useNoteTypes();
  const typeLabel = useTypeLabel(types.data?.data);
  const date = useNoteDateLabel();
  return [
    {
      key: 'title',
      head: t('title'),
      primary: true,
      sort: 'title',
      cell: (note) => <span className="plaintext line-clamp-2 font-medium">{note.title}</span>,
    },
    { key: 'type', head: t('type'), cell: (note) => (note.type ? typeLabel(note.type) : null) },
    {
      key: 'committee',
      head: t('committeeColumn'),
      cell: (note) => (note.committee ? <CommitteeChip committee={note.committee} /> : null),
    },
    {
      key: 'tasks',
      head: t('tasks'),
      numeric: true,
      cell: (note) => {
        const total = note.openTaskCount + note.doneTaskCount;
        return total > 0 ? `${note.doneTaskCount}/${total}` : null;
      },
    },
    {
      key: 'date',
      head: t('date'),
      numeric: true,
      cell: (note) => {
        const label = date(note);
        return (
          <time dateTime={note.noteDate} title={label.absolute} className="whitespace-nowrap">
            {label.label}
          </time>
        );
      },
    },
  ];
}
