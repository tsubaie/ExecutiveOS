'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { routes } from '@/core/routes';
import { useCommitteeChoices } from './queries';
export function CommitteePicker({ value = null, onChange, name }: { value?: string | null; onChange?: (id: string | null) => void; name?: string }) {
  const t = useTranslations('committees');
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  const query = useCommitteeChoices(draft);
  const items = [{ value: '', text: t('none'), label: t('none') }, ...(query.data?.data ?? []).map((row) => {
    const label = row.deleted ? `${row.name} (${t('trash')})` : row.status === 'archived' ? `${row.name} (${t('archived')})` : row.name;
    return { value: row.id, text: label, label };
  })];
  return <div className="grid min-w-0 gap-1">
    <ChoiceSelect items={items} value={draft ?? ''} label={t('committee')} disabled={query.isPending || Boolean(query.error)}
      {...(name ? { name } : {})} onChange={(id) => { setDraft(id || null); onChange?.(id || null); }} />
    {query.error && <ErrorPanel error={query.error} retry={() => void query.refetch()} />}
  </div>;
}
export function CommitteeBadge({ id }: { id: string | null }) {
  const query = useCommitteeChoices(id);
  const row = query.data?.data.find((item) => item.id === id);
  if (!id || !row) return null;
  return <CommitteeChip committee={row} />;
}

export function useCommitteeOptions() {
  const t = useTranslations('committees');
  const query = useCommitteeChoices();
  return { key: 'committeeId', label: t('committee'), options: [{ value: '', label: t('all') }, ...(query.data?.data ?? []).map((row) => ({ value: row.id, label: row.name }))] };
}

export function CommitteeChip({ committee }: { committee: { id: string; name: string; status: string; deleted: boolean } }) {
  const t = useTranslations('committees');
  const label = committee.deleted || committee.status === 'archived' ? `${committee.name} (${t(committee.deleted ? 'trash' : 'archived')})` : committee.name;
  return <Link className="inline-block max-w-32 truncate rounded-full bg-accent-soft px-2 py-1 text-xs text-accent" title={label}
    href={routes.committees({ id: committee.id, view: committee.deleted ? 'trash' : 'all' })}><bdi>{label}</bdi></Link>;
}
