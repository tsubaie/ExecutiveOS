'use client';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Database, ShieldCheck, Sparkles } from 'lucide-react';
import { useAdminResource, useAdminAction } from './queries';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
const Rows = z.array(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    status: z.string().optional(),
    kind: z.string().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    lastError: z.string().nullable().optional(),
    diff: z.json().optional(),
  }),
);
const Connection = z.object({ state: z.string(), error: z.string().nullable() });
type Resource = 'ai' | 'backups' | 'jobs' | 'audit';
type ListResource = Exclude<Resource, 'ai'>;
type Row = z.infer<typeof Rows>[number];
type Action = ReturnType<typeof useAdminAction>;
const emptyKey: Record<ListResource, 'noBackups' | 'noJobs' | 'noAudit'> = {
  backups: 'noBackups',
  jobs: 'noJobs',
  audit: 'noAudit',
};
export function AdminDataPage({ resource }: { resource: Resource }) {
  const query = useAdminResource(resource);
  const action = useAdminAction(resource);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  if (resource === 'ai')
    return <AiPanel connection={Connection.parse(query.data.data)} action={action} />;
  return <ResourceList resource={resource} rows={Rows.parse(query.data.data)} action={action} />;
}
function AiPanel({
  connection,
  action,
}: {
  connection: z.infer<typeof Connection>;
  action: Action;
}) {
  const t = useTranslations('admin');
  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border bg-surface p-6">
        <Sparkles className="mb-5 size-7 text-accent" />
        <h2 className="text-lg font-medium">
          {connection.state === 'enabled' ? t('connected') : t('disabledAI')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{t('aiHelp')}</p>
        {connection.error && <p className="mt-3 text-danger">{connection.error}</p>}
        <Button
          className="mt-5"
          variant="outline"
          disabled={action.isPending}
          onClick={() => action.mutate()}
        >
          {t('testConnection')}
        </Button>
      </div>
      <div className="rounded-xl border p-6">
        <h2 className="mb-3 font-medium">{t('disclosure')}</h2>
        <p className="text-sm leading-relaxed text-text-muted">{t('noCapabilities')}</p>
      </div>
      {action.error && <ErrorPanel error={action.error} />}
    </div>
  );
}
function ResourceList({
  resource,
  rows,
  action,
}: {
  resource: ListResource;
  rows: Row[];
  action: Action;
}) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const backups = resource === 'backups';
  return (
    <div className="space-y-5">
      {backups && <BackupsHeader action={action} />}
      {action.error && <ErrorPanel error={action.error} />}
      {action.isSuccess && backups && (
        <p role="status" className="text-sm text-success">
          {t('jobs')} · {c('saving')}
        </p>
      )}
      {rows.length ? (
        <ul className="divide-y rounded-xl border bg-surface">
          {rows.map((row) => (
            <AdminRow key={row.id} resource={resource} row={row} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border bg-surface p-8 text-sm text-text-muted">
          {t(emptyKey[resource])}
        </p>
      )}
      {backups && (
        <p className="break-words text-xs leading-relaxed text-text-muted">{t('restoreHelp')}</p>
      )}
    </div>
  );
}
function BackupsHeader({ action }: { action: Action }) {
  const t = useTranslations('admin');
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-text-muted">{t('backupDescription')}</p>
      <Button disabled={action.isPending} onClick={() => action.mutate()}>
        <Database className="size-4" />
        {t('createBackup')}
      </Button>
    </div>
  );
}
function AdminRow({ resource, row }: { resource: ListResource; row: Row }) {
  return (
    <li className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {resource === 'backups' && <ShieldCheck className="size-4 text-success" />}
          <bdi>{row.kind ?? row.action ?? row.id}</bdi>
        </span>
        <span className="text-xs text-text-muted">{row.status ?? row.entityType}</span>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        <bdi>{row.createdAt}</bdi>
      </p>
      {row.lastError && <p className="mt-2 text-sm text-danger">{row.lastError}</p>}
      {row.diff && (
        <pre className="mt-3 overflow-auto rounded-lg bg-surface-raised p-3 text-xs">
          {JSON.stringify(row.diff, null, 2)}
        </pre>
      )}
    </li>
  );
}
