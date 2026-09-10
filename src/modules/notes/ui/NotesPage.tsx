'use client';
import { useTranslations } from 'next-intl';
import {
  NotebookPen,
  CalendarDays,
  Archive,
  Trash2,
  Landmark,
  Briefcase,
  Building2,
  Users,
  User,
  StickyNote,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { View as ViewDef } from '@/ui/entity/types';
import { EntityPage } from '@/ui/entity/EntityPage';
import { Sort, type Note } from '../schema/validation';
import {
  useNotes,
  useNote,
  useNoteMutations,
  useNoteTypes,
  useTags,
  useAllPeople,
} from './queries';
import { useTypeLabel } from './use-note-labels';
import { NoteRow } from './NoteRow';
import { NoteDetail } from './NoteDetail';
import { CreateNote } from './CreateNote';
import { AddTagDialog } from './AddTagDialog';
const presentation: Record<string, Partial<ViewDef>> = {
  all: { icon: NotebookPen },
  this_week: { icon: CalendarDays, featured: true, tone: 'accent' },
  archived: { icon: Archive, separated: true },
  trash: { icon: Trash2 },
};
const typeIcons: Record<string, LucideIcon> = {
  board_meeting: Landmark,
  executive_meeting: Briefcase,
  sector_meeting: Building2,
  one_on_one: Users,
  personal: User,
  other: StickyNote,
};
// Rail: All, This week, one entry per enabled type, then Archived and Trash under a divider.
function useNoteFilters() {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const types = useNoteTypes();
  const tags = useTags();
  const people = useAllPeople();
  const typeLabel = useTypeLabel(types.data?.data);
  const enabled = (types.data?.data ?? []).filter((type) => type.enabled);
  const all = { value: '', label: c('all') };
  return {
    views: [
      { id: 'all', label: t('all'), ...presentation.all },
      { id: 'this_week', label: t('this_week'), ...presentation.this_week },
      ...enabled.map((type) => ({
        id: `type:${type.id}`,
        label: typeLabel(type.id),
        icon: typeIcons[type.id] ?? Tag,
      })),
      { id: 'archived', label: t('archived'), ...presentation.archived },
      { id: 'trash', label: t('trash'), ...presentation.trash },
    ],
    sort: {
      default: '',
      options: Sort.options.map((value) => ({
        id: value === 'default' ? '' : value,
        label: t(value),
      })),
    },
    facets: [
      {
        key: 'type',
        label: t('type'),
        options: [all, ...enabled.map((type) => ({ value: type.id, label: typeLabel(type.id) }))],
      },
      {
        key: 'tag',
        label: t('tags'),
        options: [
          all,
          ...(tags.data?.data ?? []).map((row) => ({ value: row.tag, label: row.tag })),
        ],
      },
      {
        key: 'personId',
        label: t('participants'),
        options: [
          all,
          ...(people.data?.data ?? []).map((person) => ({
            value: person.id,
            label: person.displayName ?? person.fullName,
          })),
        ],
      },
    ],
  };
}
const item = (note: Note) => ({ id: note.id, revision: note.revision });
export function NotesPage() {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const mutations = useNoteMutations();
  const filters = useNoteFilters();
  return (
    <EntityPage
      module="notes"
      title={c('notes')}
      description={t('descriptionIntro')}
      filters={filters}
      emptyState={{ icon: NotebookPen }}
      useList={useNotes}
      useDetail={useNote}
      mutations={mutations}
      group={(note) => (note.deletedAt || !note.band ? null : t(note.band))}
      bulkActions={[
        {
          id: 'archive',
          label: t('archive'),
          enabled: (items) => items.every((note) => !note.deletedAt && !note.archivedAt),
          confirm: { title: t('archiveSelected'), description: t('archiveSelectedDescription') },
          run: async (items) => {
            await mutations.bulkArchive(items.map(item));
          },
        },
        {
          id: 'tag',
          label: t('addTag'),
          enabled: (items) => items.every((note) => !note.deletedAt),
          render: (items, finish) => <AddTagDialog items={items.map(item)} finish={finish} />,
        },
      ]}
      renderers={{
        name: (note) => note.title,
        row: (note) => <NoteRow note={note} />,
        detail: (note, api) => <NoteDetail note={note} api={api} />,
        create: (api) => <CreateNote api={api} />,
      }}
    />
  );
}
