'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { EntityActionDialog } from '@/ui/entity/EntityActionDialog';
import { Tag } from '../schema/validation';
import { useNoteMutations, useTags } from './queries';
// Rendered by the entity bulk bar (NOTES-B12); `finish(true)` clears the selection on success.
export function AddTagDialog({
  items,
  finish,
}: {
  items: { id: string; revision: number }[];
  finish: (clearSelection: boolean) => void;
}) {
  const t = useTranslations('notes');
  const listId = useId();
  const tags = useTags();
  const mutations = useNoteMutations();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function apply(tag: string) {
    const parsed = Tag.safeParse(tag);
    if (!parsed.success) return;
    setPending(true);
    try {
      await mutations.bulkTag(items, parsed.data);
      finish(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(t('addTag')));
    } finally {
      setPending(false);
    }
  }
  return (
    <EntityActionDialog
      title={t('addTag')}
      description={t('addTagDescription', { count: items.length })}
      submitLabel={t('addTag')}
      error={error}
      pending={pending}
      finish={finish}
      onSubmit={(form) => apply(String(form.get('tag') ?? ''))}
    >
      <Input name="tag" list={listId} aria-label={t('tagName')} required maxLength={50} />
      <datalist id={listId}>
        {(tags.data?.data ?? []).map((row) => (
          <option key={row.tag} value={row.tag} />
        ))}
      </datalist>
    </EntityActionDialog>
  );
}
