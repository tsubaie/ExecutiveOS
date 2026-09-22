'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NEW_MENTION, type MentionItem } from '@/ui/markdown/mentions';
import { derivedParticipants, type NoteDetail, type NotePatch } from '../schema/validation';
import { useAllPeople, useNoteMutations } from './queries';
type Save = (patch: Omit<NotePatch, 'revision'>) => void;
// NOTES-B08: "@" lists the workspace's people and offers to add an unknown name; the participants
// saved with the content are the candidates whose mention appears in it. A commit waits for any
// creation still in flight, so a name added and left in one breath is not lost.
export function useMentions(note: NoteDetail, save: Save) {
  const c = useTranslations('common');
  const people = useAllPeople();
  const mutations = useNoteMutations();
  const picked = useRef<MentionItem[]>([]);
  const pending = useRef<Promise<void>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const directory: MentionItem[] = (people.data?.data ?? []).map((person) => ({
    id: person.id,
    name: person.displayName ?? person.fullName,
  }));
  const onPick = (item: MentionItem) => {
    if (!item.create) return;
    pending.current.push(
      mutations
        .createPerson(item.id.slice(NEW_MENTION.length))
        .then((person) => {
          if (person) picked.current.push({ id: person.id, name: item.name });
        })
        .catch((failure: unknown) =>
          setError(failure instanceof Error ? failure : new Error(c('error'))),
        ),
    );
  };
  const commit = (content: string) => {
    const current = note.participants.map((person) => person.id);
    void Promise.allSettled(pending.current).then(() => {
      const candidates = [
        ...directory,
        ...note.participants.map((person) => ({ id: person.id, name: person.name })),
        ...picked.current,
      ];
      const participantIds = derivedParticipants(content, candidates).filter(
        (id, index, all) => all.indexOf(id) === index,
      );
      const same =
        participantIds.length === current.length &&
        participantIds.every((id) => current.includes(id));
      save(same ? { content } : { content, participantIds });
    });
  };
  return { mentions: { items: directory, onPick, allowCreate: true }, commit, error };
}
