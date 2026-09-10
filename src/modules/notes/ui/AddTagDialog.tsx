'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <DialogContent>
        <DialogTitle>{t('addTag')}</DialogTitle>
        <DialogDescription>{t('addTagDescription', { count: items.length })}</DialogDescription>
        {error && <ErrorPanel error={error} />}
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void apply(String(new FormData(event.currentTarget).get('tag') ?? ''));
          }}
        >
          <Input name="tag" list={listId} aria-label={t('tagName')} required maxLength={50} />
          <datalist id={listId}>
            {(tags.data?.data ?? []).map((row) => (
              <option key={row.tag} value={row.tag} />
            ))}
          </datalist>
          <Button type="submit" disabled={pending}>
            {t('addTag')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
