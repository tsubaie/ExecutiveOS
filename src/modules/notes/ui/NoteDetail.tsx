'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore } from 'lucide-react';
import { CommitteeBadge } from '@/modules/committees/ui';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { DetailApi } from '@/ui/entity/types';
import type { NoteDetail as Detail } from '../schema/validation';
import { NoteFields, type Patch } from './NoteFields';
import { NoteAi } from './NoteAi';
import { NoteTasks } from './NoteTasks';
import { EntityFooter, EntityUpdated } from '@/ui/entity/EntityFooter';
import { useNoteMutations } from './queries';
export function NoteDetail({ note, api }: { note: Detail; api: DetailApi<Patch> }) {
  const c = useTranslations('common');
  return (
    <div className="min-w-0">
      {note.deletedAt ? (
        <>
          <h2 tabIndex={-1} dir="auto" className="plaintext text-xl font-semibold">
            {note.title}
          </h2>
          <Button className="mt-4" onClick={api.restore}>
            {c('restore')}
          </Button>
        </>
      ) : (
        <NoteAi key={note.id} note={note} focus={api.focus}>
          {(slots) => (
            <NoteFields
              note={note}
              save={api.save}
              focus={api.focus}
              contentAction={slots.content}
              contentNotice={slots.contentNotice}
              tagsAction={slots.tags}
              review={slots.review}
            />
          )}
        </NoteAi>
      )}
      {note.committeeId && (
        <div className="mt-3">
          <CommitteeBadge id={note.committeeId} />
        </div>
      )}
      <NoteTasks note={note} />
      <NoteFooter note={note} remove={api.remove} />
    </div>
  );
}
// Freshness at the start; archive and the destructive action at the end (NOTES-B10, B11).
function NoteFooter({ note, remove }: { note: Detail; remove: () => void }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const mutations = useNoteMutations();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function toggleArchive() {
    setPending(true);
    setError(null);
    try {
      await mutations.archive(note.id, note.revision, !note.archivedAt);
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    } finally {
      setPending(false);
    }
  }
  return (
    <EntityFooter
      remove={note.deletedAt ? null : remove}
      notice={error ? <ErrorPanel error={error} /> : null}
      actions={
        note.deletedAt ? null : (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => void toggleArchive()}>
            {note.archivedAt ? (
              <ArchiveRestore className="size-3.5" />
            ) : (
              <Archive className="size-3.5" />
            )}
            {t(note.archivedAt ? 'unarchive' : 'archive')}
          </Button>
        )
      }
    >
      <EntityUpdated at={note.updatedAt} />
    </EntityFooter>
  );
}
