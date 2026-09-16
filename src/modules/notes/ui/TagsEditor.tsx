'use client';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Input } from '@/ui/primitives/input';
import { Tags, Tag } from '../schema/validation';
import { useTags } from './queries';
import { Chip } from './NoteRow';
export const TAG_LIMIT = 10;
// The label row carries whatever acts on this field, so a tag suggestion sits with the tags it
// fills rather than in a panel of its own further down the record (NOTES-B22).
function TagsLabel({ action }: { action?: ReactNode }) {
  const t = useTranslations('notes');
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium">{t('tags')}</span>
      {action}
    </div>
  );
}
// Chips with a remove button and one input that adds on Enter or comma, with the workspace's
// existing tags as suggestions. Overflow beyond ten is blocked with a count (NOTES-I03).
// `action` is rendered on the label row, beside the field it acts on.
type TagsEditorProps = { tags: string[]; save: (tags: string[]) => void; action?: ReactNode };
export function TagsEditor({ tags, save, action }: TagsEditorProps) {
  const t = useTranslations('notes');
  const listId = useId();
  const suggestions = useTags();
  const [draft, setDraft] = useState('');
  const [blocked, setBlocked] = useState(false);
  const full = tags.length >= TAG_LIMIT;
  function add(raw: string) {
    const parsed = Tag.safeParse(raw);
    if (!parsed.success) return;
    if (full) {
      setBlocked(true);
      return;
    }
    const next = Tags.parse([...tags, parsed.data]);
    setDraft('');
    setBlocked(false);
    if (next.length !== tags.length) save(next);
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(event.currentTarget.value);
    }
  };
  return (
    <div className="grid gap-2">
      <TagsLabel action={action} />
      <div className="flex flex-wrap items-center gap-1.5">
        <TagChips tags={tags} remove={(tag) => save(tags.filter((item) => item !== tag))} />
        <Input
          list={listId}
          autoComplete="off"
          value={draft}
          aria-label={t('addTagLabel')}
          placeholder={t('addTagPlaceholder')}
          maxLength={50}
          className="h-8 w-40 text-sm"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => { void suggestions.refetch(); }}
          onKeyDown={keyDown}
          onBlur={(event) => event.target.value.trim() && add(event.target.value)}
        />
        <datalist id={listId}>
          {(suggestions.data?.data ?? [])
            .filter((row) => row.count > 0 && !tags.some((tag) => tag.toLowerCase() === row.tag.toLowerCase()))
            .map((row) => (
              <option key={row.tag} value={row.tag} />
            ))}
        </datalist>
      </div>
      {(blocked || full) && (
        <span role={blocked ? 'alert' : undefined} className="text-xs text-text-muted">
          {t('tagOverflow', { count: tags.length, limit: TAG_LIMIT })}
        </span>
      )}
    </div>
  );
}
function TagChips({ tags, remove }: { tags: string[]; remove: (tag: string) => void }) {
  const t = useTranslations('notes');
  return tags.map((tag) => (
    <span key={tag} className="inline-flex items-center gap-0.5">
      <Chip tone="tag">{tag}</Chip>
      <button
        type="button"
        aria-label={t('removeTag', { tag })}
        className="flex size-6 items-center justify-center rounded-md text-text-muted hover:text-danger"
        onClick={() => remove(tag)}
      >
        <X className="size-3" />
      </button>
    </span>
  ));
}
