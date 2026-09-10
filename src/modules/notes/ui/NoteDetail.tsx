'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useDateTime, useRelativeTime } from '@/ui/format';
import type { DetailApi } from '@/ui/entity/types';
import type { NoteDetail as Detail } from '../schema/validation';
import { NoteFields, type Patch } from './NoteFields';
import { NoteTasks } from './NoteTasks';
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
        <NoteFields note={note} save={api.save} />
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
  const dateTime = useDateTime();
  const relative = useRelativeTime();
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
    <footer className="mt-6 grid gap-2 border-t pt-3 text-xs text-text-muted">
      {error && <ErrorPanel error={error} />}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span title={dateTime(note.updatedAt)}>
          {t('updated', { date: relative(note.updatedAt) })}
        </span>
        {!note.deletedAt && (
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => void toggleArchive()}
            >
              {note.archivedAt ? (
                <ArchiveRestore className="size-3.5" />
              ) : (
                <Archive className="size-3.5" />
              )}
              {t(note.archivedAt ? 'unarchive' : 'archive')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={remove}
            >
              <Trash2 className="size-3.5" />
              {c('delete')}
            </Button>
          </span>
        )}
      </div>
    </footer>
  );
}
