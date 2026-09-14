'use client';
import { useTranslations } from 'next-intl';
import { Tabs } from '@base-ui/react/tabs';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useDateTime } from '@/ui/format';
import type { DetailApi } from '@/ui/entity/types';
import { CommitteeTasks } from '@/modules/tasks/ui';
import { CommitteeNotes } from '@/modules/notes/ui';
import type { Committee, CommitteePatch } from '../schema/validation';
import { CommitteeFields } from './CommitteeFields';
import { useCommitteeActivity } from './queries';
const tabs: Array<'tasks' | 'notes' | 'activity'> = ['tasks', 'notes', 'activity'];
export function CommitteeDetail({ committee, api }: { committee: Committee; api: DetailApi<Omit<CommitteePatch, 'revision'>> }) {
  const t = useTranslations('committees');
  const c = useTranslations('common');
  return <div className="space-y-5">
    <h2 tabIndex={-1} dir="auto" className="text-xl font-semibold">{committee.name}</h2>
    {committee.deletedAt ? <Button onClick={api.restore}>{c('restore')}</Button> : <CommitteeFields initial={committee} save={api.save} />}
    <Tabs.Root defaultValue="tasks">
      <Tabs.List aria-label={t('linkedWork')} className="mb-4 flex gap-2 border-b">
        {tabs.map((tab) => <Tabs.Tab key={tab} value={tab} className="border-b-2 border-transparent px-3 py-2 text-sm data-active:border-accent data-active:text-accent">{t(tab)}</Tabs.Tab>)}
      </Tabs.List>
      <Tabs.Panel value="tasks"><CommitteeTasks committeeId={committee.id} allowCreate={!committee.deletedAt && committee.status === 'active'} /></Tabs.Panel>
      <Tabs.Panel value="notes"><CommitteeNotes committeeId={committee.id} allowCreate={!committee.deletedAt && committee.status === 'active'} /></Tabs.Panel>
      <Tabs.Panel value="activity"><CommitteeActivity id={committee.id} /></Tabs.Panel>
    </Tabs.Root>
    {!committee.deletedAt && <Button variant="ghost" className="text-danger" onClick={api.remove}>{c('delete')}</Button>}
  </div>;
}
function CommitteeActivity({ id }: { id: string }) {
  const t = useTranslations('committees');
  const c = useTranslations('common');
  const dateTime = useDateTime();
  const query = useCommitteeActivity(id);
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  return <div className="space-y-3">
    {query.error && <ErrorPanel error={query.error} />}
    {query.isPending && <p role="status">{c('loading')}</p>}
    {!query.isPending && !rows.length && <p className="text-sm text-text-muted">{t('noActivity')}</p>}
    {rows.map((row) => <div key={row.id} className="space-y-1 rounded-lg border p-3 text-sm">
      <p>{t('activityEntry', { entity: t(row.entityType === 'task' ? 'taskEntity' : row.entityType === 'note' ? 'noteEntity' : 'committee'), action: t(activityAction(row.action)) })}</p><time className="text-xs text-text-muted" dateTime={row.createdAt}>{dateTime(row.createdAt)}</time>
    </div>)}
    {query.hasNextPage && <Button variant="ghost" onClick={() => void query.fetchNextPage()}>{c('more')}</Button>}
  </div>;
}

function activityAction(action: string) {
  switch (action) {
    case 'create': return 'actionCreate';
    case 'archive': return 'actionArchive';
    case 'unarchive': return 'actionUnarchive';
    case 'delete': return 'actionDelete';
    case 'restore': return 'actionRestore';
    case 'reorder': return 'actionReorder';
    default: return 'actionUpdate';
  }
}
