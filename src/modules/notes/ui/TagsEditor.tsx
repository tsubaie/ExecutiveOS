'use client';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Input } from '@/ui/primitives/input';
import { Tags, Tag } from '../schema/validation';
import { useTags } from './queries';
import { Chip } from './NoteRow';
export const TAG_LIMIT = 10;
// Chips with a remove button and one input that adds on Enter or comma, with the workspace's
// existing tags as suggestions. Overflow beyond ten is blocked with a count (NOTES-I03).
export function TagsEditor({ tags, save }: { tags: string[]; save: (tags: string[]) => void }) {
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
      <span className="text-sm font-medium">{t('tags')}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <TagChips tags={tags} remove={(tag) => save(tags.filter((item) => item !== tag))} />
        <Input
          list={listId}
          value={draft}
          aria-label={t('addTagLabel')}
          placeholder={t('addTagPlaceholder')}
          maxLength={50}
          className="h-8 w-40 text-sm"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={keyDown}
          onBlur={(event) => event.target.value.trim() && add(event.target.value)}
        />
        <datalist id={listId}>
          {(suggestions.data?.data ?? [])
            .filter((row) => !tags.includes(row.tag))
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
