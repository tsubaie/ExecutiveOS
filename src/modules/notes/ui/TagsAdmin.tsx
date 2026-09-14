'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
import { ManageTags } from '../schema/validation';
import { useManagedTags, useManageTags } from './tag-queries';

export function TagsAdmin() {
  const t = useTranslations('tagAdmin');
  const c = useTranslations('common');
  const query = useManagedTags();
  const mutation = useManageTags();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('');
  const [pending, setPending] = useState<ManageTags | null>(null);
  const tags = query.data?.data ?? [];
  const current = selected.filter((tag) => tags.some((row) => row.tag === tag));
  const stage = (name: string | null) => {
    const parsed = ManageTags.safeParse({ tags: current, target: name });
    if (parsed.success) { mutation.reset(); setPending(parsed.data); }
  };
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const toggle = (tag: string, checked: boolean) => setSelected(checked ? [...current, tag] : current.filter((value) => value !== tag));
  return <section className="space-y-4 rounded-xl border bg-surface p-6">
    <h2 className="text-lg font-medium">{t('title')}</h2>
    <p className="text-sm text-text-muted">{t('help')}</p>
    <>
      <fieldset disabled={mutation.isPending || pending !== null} className="space-y-4">
        <Field label={t('search')}>{(control) => <Input {...control} value={search} onChange={(event) => setSearch(event.target.value)} />}</Field>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {tags.filter((row) => row.tag.toLowerCase().includes(search.trim().toLowerCase())).map((row) =>
            <label key={row.tag} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={current.includes(row.tag)} onCheckedChange={(checked) => toggle(row.tag, checked === true)} />
              <bdi className="flex-1">{row.tag}</bdi><span className="text-text-muted">{t('usage', { count: row.count })}</span>
            </label>)}
          {!tags.some((row) => row.tag.toLowerCase().includes(search.trim().toLowerCase())) && <p className="text-sm text-text-muted">{t('empty')}</p>}
        </div>
        <p className="text-sm text-text-muted">{t('selected', { count: current.length })}</p>
        <Field label={t('target')}>{(control) => <Input {...control} dir="auto" maxLength={50} value={target} onChange={(event) => setTarget(event.target.value)} />}</Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!ManageTags.safeParse({ tags: current, target }).success} onClick={() => stage(target)}>{t('merge')}</Button>
          <Button variant="outline" disabled={!current.length || current.length > 200} onClick={() => stage(null)}>{t('delete')}</Button>
        </div>
      </fieldset>
      {pending && <div className="space-y-3 rounded-lg border border-accent p-4">
        <TagConfirmation target={pending.target} />
        <p dir="auto" className="text-sm text-text-muted">{pending.tags.join('، ')}</p>
        <div className="flex gap-2">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(pending, { onSuccess: () => { setPending(null); setSelected([]); setTarget(''); } })}>{mutation.isPending ? c('saving') : t('confirm')}</Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setPending(null)}>{c('cancel')}</Button>
        </div>
      </div>}
      {mutation.isSuccess && <p role="status" className="text-success">{t('updated', { count: mutation.data.data.updatedCount })}</p>}
      {mutation.error && <ErrorPanel error={mutation.error} />}
    </>
  </section>;
}

function TagConfirmation({ target }: { target: string | null }) {
  const t = useTranslations('tagAdmin');
  return <p>{target === null ? t('confirmDelete') : t('confirmMerge', { target })}</p>;
}
