'use client';
import { useTranslations } from 'next-intl';
import { RelatedEntities } from '@/ui/entity/RelatedEntities';
import { useNotes, useNote, useNoteMutations } from './queries';
import { NoteRow, NoteTrail } from './NoteRow';
import { NoteDetail } from './NoteDetail';
import { CreateNote } from './CreateNote';
export function CommitteeNotes({ committeeId, allowCreate = true }: { committeeId: string; allowCreate?: boolean }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const mutations = useNoteMutations();
  return <RelatedEntities allowCreate={allowCreate} filters={{ view: 'all', q: '', sort: '', committeeId }} config={{
    module: 'notes', title: c('notes'), description: t('descriptionIntro'),
    filters: { views: [{ id: 'all', label: t('all') }, { id: 'archived', label: t('archived') }] },
    useList: useNotes, useDetail: useNote, mutations,
    renderers: { row: (note) => <NoteRow note={note} />, rowTrail: (note) => <NoteTrail note={note} />, name: (note) => note.title, deletedMessage: t('deletedToast'),
      detail: (note, api) => <NoteDetail note={note} api={api} />, create: (api) => <CreateNote committeeId={committeeId} api={api} /> },
  }} />;
}
