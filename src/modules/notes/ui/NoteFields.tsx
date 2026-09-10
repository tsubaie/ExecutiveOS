'use client';
import { useState, type FocusEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/ui/primitives/textarea';
import { Property } from '@/ui/layout/Property';
import { ChoiceSelect, type Choice } from '@/ui/layout/ChoiceSelect';
import { DatePicker } from '@/ui/layout/DatePicker';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import type { NoteDetail, NotePatch } from '../schema/validation';
import { useNoteTypes } from './queries';
import { useTypeLabel } from './use-note-labels';
import { ParticipantsEditor } from './ParticipantsEditor';
import { TagsEditor } from './TagsEditor';
export type Patch = Omit<NotePatch, 'revision'>;
type Save = (patch: Patch) => void;
// The detail panel: the title is the heading, then type and date rows, participants, tags and the
// markdown content. Every field commits on leave through the framework save queue.
export function NoteFields({ note, save }: { note: NoteDetail; save: Save }) {
  const t = useTranslations('notes');
  const { draft, change } = useDraftProperties(note, save);
  return (
    <fieldset data-autosave className="grid min-w-0 gap-4">
      <NoteTitle title={note.title} save={save} />
      <div className="grid gap-2">
        <Property label={t('type')}>
          <TypeSelect
            value={draft.type}
            current={note.type}
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
      <ParticipantsEditor
        participants={note.participants}
        save={(participantIds) => save({ participantIds })}
      />
      <TagsEditor tags={note.tags} save={(tags) => save({ tags })} />
      <MarkdownField
        label={t('content')}
        value={note.content}
        onCommit={(content) => save({ content })}
      />
    </fieldset>
  );
}
type Properties = { type: string; noteDate: string | null };
// Pickers are controlled from a draft re-based on the saved note whenever it changes, without
// remounting, so a picker keeps focus after its own save. A picker reporting the value it already
// shows is not an edit and never writes.
function useDraftProperties(note: NoteDetail, save: Save) {
  const base: Properties = { type: note.type, noteDate: note.noteDate };
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
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.noteDate ? { noteDate: patch.noteDate } : {}),
    });
  };
  return { draft, change };
}
// Enabled types, plus the note's current type when it has since been disabled (NOTES-I02).
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
  const items: Choice[] = ids.map((id) => ({ value: id, text: label(id), label: label(id) }));
  if (!items.length) items.push({ value: '', text: t('type'), label: t('type') });
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
