'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Landmark, Archive, Trash2, CalendarDays, AlertCircle, ListChecks, CheckCircle2 } from 'lucide-react';
import { EntityPage } from '@/ui/entity/EntityPage';
import { sortOptions } from '@/ui/entity/filters';
import { usePlainDate, useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import { Scope, Sort, type Committee } from '../schema/validation';
import { useCommittees, useCommittee, useCommitteeMutations } from './queries';
import { CreateCommittee } from './CreateCommittee';
import { useCommitteeColumns } from './CommitteeColumns';
const CommitteeDetail = dynamic(() => import('./CommitteeDetail').then((module) => module.CommitteeDetail));
export function CommitteesPage() {
  const t = useTranslations('committees');
  const mutations = useCommitteeMutations();
  const columns = useCommitteeColumns();
  return <EntityPage module="committees" title={t('title')} description={t('intro')}
    filters={{ views: [
      { id: 'active', label: t('active'), icon: Landmark }, { id: 'all', label: t('all'), icon: Landmark },
      { id: 'overdue', label: t('overdue'), icon: AlertCircle, featured: true, tone: 'danger' },
      { id: 'today', label: t('today'), icon: CalendarDays, featured: true, tone: 'accent' },
      { id: 'open', label: t('open'), icon: ListChecks, featured: true },
      { id: 'completed', label: t('completed'), icon: CheckCircle2, featured: true },
      { id: 'archived', label: t('archived'), icon: Archive, separated: true }, { id: 'trash', label: t('trash'), icon: Trash2 },
    ], sort: sortOptions(Sort.options, t), facets: [{ key: 'scope', label: t('scope'), options: [{ value: '', label: t('all') }, ...Scope.options.map((scope) => ({ value: scope, label: t(scope) }))] }] }}
    useList={useCommittees} useDetail={useCommittee} mutations={mutations} group={(item) => item.deletedAt ? null : t(item.scope)}
    renderers={{ rowStyle: 'card', columns, name: (item) => item.name, row: (item) => <CommitteeRow committee={item} />,
      rowTrail: (item) => <CommitteeStats committee={item} />, detail: (item, api) => <CommitteeDetail committee={item} api={api} />,
      create: (api) => <CreateCommittee api={api} /> }} />;
}
function CommitteeRow({ committee }: { committee: Committee }) {
  const t = useTranslations('committees');
  return <span className="flex min-w-0 flex-1 items-center gap-3">
    <span aria-hidden={true} className={cn('size-2 shrink-0 rounded-full', committee.status === 'active' ? 'bg-success' : 'bg-text-muted')} />
    <span className="grid min-w-0 gap-1"><span dir="auto" className="line-clamp-2 text-sm font-medium whitespace-normal">{committee.name}</span>
      {committee.ownership && <span dir="auto" className="truncate text-xs font-normal text-text-muted">{committee.ownership}</span>}</span>
    <span className="shrink-0 rounded-full bg-surface-raised px-2 py-1 text-xs font-normal text-text-muted">{t(committee.scope)}</span>
  </span>;
}
function CommitteeStats({ committee }: { committee: Committee }) {
  const t = useTranslations('committees');
  const date = usePlainDate();
  const count = useCount();
  const total = committee.stats.open + committee.stats.completed;
  return <span className="flex items-center gap-2 text-xs text-text-muted">
    {committee.status === 'archived' && <span>{t('archived')}</span>}
    <span title={t('taskProgress', { done: committee.stats.completed, total })}>{count(committee.stats.completed)}/{count(total)}</span>
    {committee.lastNoteDate && <time className="hidden @2xl:inline" dateTime={committee.lastNoteDate} title={t('lastNote', { date: date(committee.lastNoteDate) })}>{date(committee.lastNoteDate)}</time>}
    {committee.stats.overdue > 0 && <span className="text-danger">{t('overdueCount', { count: committee.stats.overdue })}</span>}
  </span>;
}
