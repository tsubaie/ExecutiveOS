'use client';
import { useState, type FocusEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/ui/primitives/textarea';
import { Property } from '@/ui/layout/Property';
import { DatePicker } from '@/ui/layout/DatePicker';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import type { NoteDetail, NotePatch } from '../schema/validation';
import type { DetailApi } from '@/ui/entity/types';
import { useMentions } from './use-mentions';
import { TemplateSelect, TypeSelect } from './NoteSelects';
import { CommitteePicker } from '@/modules/committees/ui';
import { TagsEditor } from './TagsEditor';
import { ParticipantLinks } from './ParticipantLinks';
export type Patch = Omit<NotePatch, 'revision'>;
// NOTES-B18: a proposal under review takes the content field's place in the expanded view: its
// draft is what the field shows and commits, and the band and the original ride along.
export type ReviewSlot = {
  value: string;
  onCommit: (value: string) => void;
  banner: ReactNode;
  aside: ReactNode;
};
type Save = (patch: Patch) => void;
// The detail panel: the title is the heading, then type and date rows, the participants (people
// mentioned in the content, linking to their pages), tags and the markdown content. Every field
// commits on leave through the framework save queue.
export function NoteFields({
  note,
  save,
  focus,
  contentAction,
  tagsAction,
  review = null,
}: {
  note: NoteDetail;
  save: Save;
  // EP-B44 / NOTES-B28: which field is in the expanded view, carried in the URL by the page.
  focus: DetailApi<Patch>['focus'];
  // The AI actions belong to the fields they transform, so they arrive as slots rather than
  // floating in a row above the record (NOTES-B22).
  contentAction?: ReactNode;
  tagsAction?: ReactNode;
  review?: ReviewSlot | null;
}) {
  const committees = useTranslations('committees');
  const { draft, change } = useDraftProperties(note, save);
  const mentions = useMentions(note, save);
  return (
    <fieldset data-autosave className="grid min-w-0 gap-4">
      <NoteTitle title={note.title} save={save} />
      <TypeAndDate note={note} draft={draft} change={change} />
      <Property label={committees('committee')} quiet empty={!note.committeeId}>
        <CommitteePicker
          value={note.committeeId}
          onChange={(committeeId) => save({ committeeId })}
        />
      </Property>
      <ParticipantLinks participants={note.participants} />
      <TagsEditor tags={note.tags} save={(tags) => save({ tags })} action={tagsAction} />
      {mentions.error && <ErrorPanel error={mentions.error} />}
      <ContentField
        note={note}
        focus={focus}
        review={review}
        mentions={mentions}
        action={<ContentActions note={note} save={save} action={contentAction} />}
      />
    </fieldset>
  );
}
// Type and date, controlled from the draft (useDraftProperties).
function TypeAndDate({
  note,
  draft,
  change,
}: {
  note: NoteDetail;
  draft: Properties;
  change: (patch: Partial<Properties>) => void;
}) {
  const t = useTranslations('notes');
  return (
    <div className="grid gap-2">
      <Property label={t('type')} quiet empty={!draft.type}>
        <TypeSelect
          value={draft.type}
          current={note.type ?? ''}
          onChange={(next) => change({ type: next })}
        />
      </Property>
      <Property label={t('date')} quiet empty={!draft.noteDate}>
        <DatePicker
          value={draft.noteDate}
          label={t('date')}
          onChange={(next) => next && change({ noteDate: next })}
        />
      </Property>
    </div>
  );
}
// The content: the note's own text, or a proposal's draft while one is under review (NOTES-B18).
function ContentField({
  note,
  focus,
  review,
  mentions,
  action,
}: {
  note: NoteDetail;
  focus: DetailApi<Patch>['focus'];
  review: ReviewSlot | null;
  mentions: ReturnType<typeof useMentions>;
  action: ReactNode;
}) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  return (
    <MarkdownField
      label={t('content')}
      value={review?.value ?? note.content}
      mentions={mentions.mentions}
      onCommit={review?.onCommit ?? mentions.commit}
      action={action}
      expand={{ ...expandFor(note, focus, c), banner: review?.banner, aside: review?.aside }}
    />
  );
}
// NOTES-B27: an empty note offers a template to insert, beside whatever the AI slot holds.
function ContentActions({
  note,
  save,
  action,
}: {
  note: NoteDetail;
  save: Save;
  action: ReactNode;
}) {
  const t = useTranslations('notes');
  return (
    <>
      {!note.content.trim() && (
        <TemplateSelect
          value=""
          label={t('insertTemplate')}
          onPick={(_id, body) => body && save({ content: body })}
        />
      )}
      {action}
    </>
  );
}
// EP-B44 / NOTES-B28: the content's expanded view, keyed `content` in the URL and headed by the
// note's title.
function expandFor(
  note: NoteDetail,
  focus: DetailApi<Patch>['focus'],
  c: ReturnType<typeof useTranslations<'common'>>,
) {
  return {
    title: note.title,
    open: focus.key === 'content',
    setOpen: (open: boolean) => focus.set(open ? 'content' : null),
    labels: {
      expand: c('expandContent'),
      collapse: c('collapseContent'),
      description: c('expandedDescription'),
    },
  };
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
          className="plaintext min-h-0 resize-none rounded-md border-transparent bg-transparent px-2 py-1 text-2xl leading-snug font-semibold hover:border-border dark:bg-transparent md:text-2xl"
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
