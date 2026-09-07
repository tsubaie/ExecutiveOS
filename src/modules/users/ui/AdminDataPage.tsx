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
export function AdminDataPage({ resource }: { resource: 'ai' | 'backups' | 'jobs' | 'audit' }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const query = useAdminResource(resource);
  const action = useAdminAction(resource);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  if (resource === 'ai') {
    const connection = z
      .object({ state: z.string(), error: z.string().nullable() })
      .parse(query.data.data);
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
  const rows = Rows.parse(query.data.data);
  return (
    <div className="space-y-5">
      {resource === 'backups' && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-text-muted">{t('backupDescription')}</p>
          <Button disabled={action.isPending} onClick={() => action.mutate()}>
            <Database className="size-4" />
            {t('createBackup')}
          </Button>
        </div>
      )}
      {action.error && <ErrorPanel error={action.error} />}{' '}
      {action.isSuccess && resource === 'backups' && (
        <p role="status" className="text-sm text-success">
          {t('jobs')} · {c('saving')}
        </p>
      )}
      {!rows.length ? (
        <p className="rounded-xl border bg-surface p-8 text-sm text-text-muted">
          {resource === 'backups'
            ? t('noBackups')
            : resource === 'jobs'
              ? t('noJobs')
              : t('noAudit')}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-surface">
          {rows.map((row) => (
            <li key={row.id} className="p-5">
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
          ))}
        </ul>
      )}
      {resource === 'backups' && (
        <p className="break-words text-xs leading-relaxed text-text-muted">{t('restoreHelp')}</p>
      )}
    </div>
  );
}
