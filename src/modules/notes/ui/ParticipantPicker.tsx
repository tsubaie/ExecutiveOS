'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
} from '@/ui/primitives/combobox';
import { Avatar } from '@/ui/layout/Avatar';
const NEW = 'new:';
// Searchable picker over people not yet on the note; an unknown name offers "Add <name>" as a
// synthetic item whose value carries the typed name (NOTES-B08). Loaded lazily by the editor.
export default function ParticipantPicker({
  candidates,
  choose,
}: {
  candidates: { id: string; name: string }[];
  choose: (value: string) => void;
}) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const [query, setQuery] = useState('');
  const nameOf = new Map(candidates.map((person) => [person.id, person.name]));
  const typed = query.trim();
  const exact = typed && candidates.some((person) => person.name === typed);
  const values = [...nameOf.keys(), ...(typed && !exact ? [NEW + typed] : [])];
  const label = (value: string) =>
    value.startsWith(NEW)
      ? t('addPerson', { name: value.slice(NEW.length) })
      : (nameOf.get(value) ?? '');
  return (
    <Combobox
      items={values}
      value={null}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={label}
      onValueChange={(next) => {
        if (next === null) return;
        setQuery('');
        choose(next);
      }}
    >
      <ComboboxTrigger size="sm" aria-label={t('addParticipant')} className="w-auto">
        <Plus className="size-3.5" />
        {t('addParticipant')}
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder={c('search')} aria-label={t('participantSearch')} />
        <ComboboxEmpty>{c('noMatches')}</ComboboxEmpty>
        <ComboboxList>
          {(value: string) => (
            <ComboboxItem key={value} value={value}>
              {value.startsWith(NEW) ? (
                <Plus className="size-4 text-accent" />
              ) : (
                <Avatar name={label(value)} className="size-5 text-[9px]" />
              )}
              <span className="truncate">{label(value)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
