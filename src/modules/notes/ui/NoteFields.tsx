'use client';
import { useState, type FocusEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/ui/primitives/textarea';
import { Property } from '@/ui/layout/Property';
import { ChoiceSelect, type Choice } from '@/ui/layout/ChoiceSelect';
import { DatePicker } from '@/ui/layout/DatePicker';
import { Avatar } from '@/ui/layout/Avatar';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import { NEW_MENTION, derivedParticipants, type MentionItem } from '@/ui/markdown/mentions';
import { routes } from '@/core/routes';
import type { NoteDetail, NotePatch, Participant } from '../schema/validation';
import { useAllPeople, useNoteMutations, useNoteTypes } from './queries';
import { useTypeLabel } from './use-note-labels';
import { TagsEditor } from './TagsEditor';
export type Patch = Omit<NotePatch, 'revision'>;
type Save = (patch: Patch) => void;
// The detail panel: the title is the heading, then type and date rows, the participants (people
// mentioned in the content, linking to their pages), tags and the markdown content. Every field
// commits on leave through the framework save queue.
export function NoteFields({ note, save }: { note: NoteDetail; save: Save }) {
  const t = useTranslations('notes');
  const { draft, change } = useDraftProperties(note, save);
  const mentions = useMentions(note, save);
  return (
    <fieldset data-autosave className="grid min-w-0 gap-4">
      <NoteTitle title={note.title} save={save} />
      <div className="grid gap-2">
        <Property label={t('type')}>
          <TypeSelect
            value={draft.type}
            current={note.type ?? ''}
            onChange={(next) => change({ type: next })}
          />
        </Property>
        <Property label={t('date')}>
          <DatePicker
            value={draft.noteDate}
            label={t('date')}
            onChange={(next) => next && change({ noteDate: next })}
          />
        </Property>
      </div>
      <ParticipantLinks participants={note.participants} />
      <TagsEditor tags={note.tags} save={(tags) => save({ tags })} />
      {mentions.error && <ErrorPanel error={mentions.error} />}
      <MarkdownField
        label={t('content')}
        value={note.content}
        mentions={mentions.mentions}
        onCommit={mentions.commit}
      />
    </fieldset>
  );
}
// NOTES-B08: "@" lists the workspace's people and offers to add an unknown name; the participants
// saved with the content are the candidates whose mention appears in it. People picked in this
// session stay candidates even before the directory query refreshes.
function useMentions(note: NoteDetail, save: Save) {
  const c = useTranslations('common');
  const people = useAllPeople();
  const mutations = useNoteMutations();
  const [picked, setPicked] = useState<MentionItem[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const directory: MentionItem[] = (people.data?.data ?? []).map((person) => ({
    id: person.id,
    name: person.displayName ?? person.fullName,
  }));
  const candidates = [
    ...directory,
    ...note.participants.map((person) => ({ id: person.id, name: person.name })),
    ...picked,
  ].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
  const onPick = (item: MentionItem) => {
    if (!item.create) return;
    void mutations
      .createPerson(item.id.slice(NEW_MENTION.length))
      .then((person) => {
        if (person) setPicked((current) => [...current, { id: person.id, name: item.name }]);
      })
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure : new Error(c('error'))),
      );
  };
  const commit = (content: string) => {
    const participantIds = derivedParticipants(content, candidates);
    const current = note.participants.map((person) => person.id);
    const same =
      participantIds.length === current.length &&
      participantIds.every((id) => current.includes(id));
    save(same ? { content } : { content, participantIds });
  };
  return { mentions: { items: directory, onPick, allowCreate: true }, commit, error };
}
// Read-only: each participant links to their page, like the owner link on a task.
function ParticipantLinks({ participants }: { participants: Participant[] }) {
  const t = useTranslations('notes');
  if (!participants.length) return null;
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t('participants')}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {participants.map((person) => (
          <Link
            key={person.id}
            href={routes.person(person.id)}
            className="inline-flex items-center gap-1 rounded-full bg-surface-raised py-0.5 ps-0.5 pe-2 text-xs text-accent hover:bg-accent-soft"
          >
            <Avatar name={person.name} className="size-5 text-[9px]" />
            <bdi>{person.name}</bdi>
          </Link>
        ))}
      </div>
    </div>
  );
}
type Properties = { type: string; noteDate: string | null };
// Pickers are controlled from a draft re-based on the saved note whenever it changes, without
// remounting, so a picker keeps focus after its own save. A picker reporting the value it already
// shows is not an edit and never writes.
function useDraftProperties(note: NoteDetail, save: Save) {
  const base: Properties = { type: note.type ?? '', noteDate: note.noteDate };
  const [draft, setDraft] = useState(base);
  const [seen, setSeen] = useState(base);
  if (seen.type !== base.type || seen.noteDate !== base.noteDate) {
    setSeen(base);
    setDraft(base);
  }
  const change = (patch: Partial<Properties>) => {
    if (
      (patch.type === undefined || patch.type === draft.type) &&
      (patch.noteDate === undefined || patch.noteDate === draft.noteDate)
    )
      return;
    setDraft((current) => ({ ...current, ...patch }));
    save({
      ...(patch.type !== undefined ? { type: patch.type || null } : {}),
      ...(patch.noteDate ? { noteDate: patch.noteDate } : {}),
    });
  };
  return { draft, change };
}
// "No type" first, then the enabled types, plus the note's current type when it has since been
// disabled (NOTES-I02).
export function TypeSelect({
  value,
  current,
  onChange,
  name,
}: {
  value: string;
  current?: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  const t = useTranslations('notes');
  const types = useNoteTypes();
  const label = useTypeLabel(types.data?.data);
  const ids = (types.data?.data ?? []).filter((type) => type.enabled).map((type) => type.id);
  if (current && !ids.includes(current)) ids.unshift(current);
  if (value && !ids.includes(value)) ids.unshift(value);
  const items: Choice[] = [
    { value: '', text: t('noType'), label: t('noType') },
    ...ids.map((id) => ({ value: id, text: label(id), label: label(id) })),
  ];
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={t('type')}
      disabled={types.isPending || Boolean(types.error)}
      {...(name ? { name } : {})}
      onChange={onChange}
    />
  );
}
// The title is the heading itself: Enter commits, the accessible label stays "Note title".
function NoteTitle({ title, save }: { title: string; save: Save }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const [draft, setDraft] = useState(title);
  const [seen, setSeen] = useState(title);
  if (seen !== title) {
    setSeen(title);
    setDraft(title);
  }
  const invalid = !draft.trim();
  const blur = (event: FocusEvent<HTMLTextAreaElement>) => {
    const next = event.target.value.trim();
    if (next && next !== title) save({ title: next });
  };
  return (
    <div className="grid gap-1">
      <h2 tabIndex={-1} className="min-w-0 rounded-md">
        <Textarea
          dir="auto"
          required
          rows={1}
          maxLength={500}
          value={draft}
          aria-label={t('title')}
          aria-invalid={invalid}
          className="plaintext min-h-0 resize-none rounded-md border-transparent px-2 py-1 text-xl leading-snug font-semibold hover:border-border md:text-xl"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onBlur={blur}
        />
      </h2>
      {invalid && (
        <span role="alert" className="px-2 text-xs text-danger">
          {c('titleRequired')}
        </span>
      )}
    </div>
  );
}
