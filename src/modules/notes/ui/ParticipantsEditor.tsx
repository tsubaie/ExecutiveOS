'use client';
import { Suspense, lazy, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Avatar } from '@/ui/layout/Avatar';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { Participant } from '../schema/validation';
import { useAllPeople, useNoteMutations } from './queries';
const NEW = 'new:';
// The searchable picker loads on demand so the combobox stays out of the route bundle.
const ParticipantPicker = lazy(() => import('./ParticipantPicker'));
// Avatar chips with a remove button and a searchable picker over every person; an unknown name
// offers "Add <name>", which creates an external, non-assignable person (NOTES-B08).
export function ParticipantsEditor({
  participants,
  save,
}: {
  participants: Participant[];
  save: (participantIds: string[]) => void;
}) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const people = useAllPeople();
  const mutations = useNoteMutations();
  const [error, setError] = useState<Error | null>(null);
  const current = participants.map((person) => person.id);
  const candidates = (people.data?.data ?? [])
    .filter((person) => !current.includes(person.id))
    .map((person) => ({ id: person.id, name: person.displayName ?? person.fullName }));
  async function add(value: string) {
    try {
      const personId = value.startsWith(NEW)
        ? (await mutations.createPerson(value.slice(NEW.length)))?.id
        : value;
      if (personId) save([...current, personId]);
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    }
  }
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t('participants')}</span>
      {error && <ErrorPanel error={error} />}
      <div className="flex flex-wrap items-center gap-1.5">
        {participants.map((person) => (
          <ParticipantChip
            key={person.id}
            person={person}
            remove={() => save(current.filter((id) => id !== person.id))}
          />
        ))}
        <Suspense
          fallback={
            <Button variant="outline" size="sm" disabled>
              <Plus className="size-3.5" />
              {t('addParticipant')}
            </Button>
          }
        >
          <ParticipantPicker candidates={candidates} choose={(value) => void add(value)} />
        </Suspense>
      </div>
    </div>
  );
}
function ParticipantChip({ person, remove }: { person: Participant; remove: () => void }) {
  const t = useTranslations('notes');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised py-0.5 ps-0.5 pe-1 text-xs">
      <Avatar name={person.name} className="size-5 text-[9px]" />
      <bdi>{person.name}</bdi>
      <button
        type="button"
        aria-label={t('removeParticipant', { name: person.name })}
        className="flex size-6 items-center justify-center rounded-full text-text-muted hover:text-danger"
        onClick={remove}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
