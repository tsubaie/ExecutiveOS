'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useDateTime, useRelativeTime } from '@/ui/format';
import type { DetailApi } from '@/ui/entity/types';
import { KpiHeadline, KpiTrend, PreviousPeriod } from './KpiHeadline';
import { KpiReadings } from './KpiReadings';
import { KpiTargets } from './KpiTargets';
import { KpiFields } from './KpiFields';
import { useKpi } from './queries';
import type { Kpi, KpiPatch } from '../schema/validation';
// KPIS-B08, EP-B25: a KPI is read far more often than it is edited, so the panel reads as a record
// and becomes a form on contact — the same shape every other entity uses. The answer comes first
// (the arc and the figures behind it), then the definition as quiet property rows, then the series
// and the two tables the measure is maintained from, each under its own heading the way subtasks
// sit under a task. It used to hide the definition inside a tab strip, which made the record look
// like a settings dialog and buried the properties a reader scans for.
export function KpiRecord({ kpi, api }: { kpi: Kpi; api: DetailApi<Omit<KpiPatch, 'revision'>> }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const record = useKpi(kpi.id, Boolean(kpi.deletedAt));
  const data = record.data;
  const editable = !kpi.deletedAt;
  return (
    <div className="@container min-w-0">
      <h2 tabIndex={-1} dir="auto" className="plaintext text-xl font-semibold">
        {kpi.name}
      </h2>
      {kpi.deletedAt && (
        <Button className="mt-4" onClick={api.restore}>
          {c('restore')}
        </Button>
      )}
      {record.error && <ErrorPanel error={record.error} />}
      {!data ? (
        <p role="status" className="mt-4 text-sm text-text-muted">
          {c('loading')}
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-5">
            <KpiHeadline kpi={data} />
            <div className="grid gap-2">
              <PreviousPeriod kpi={data} />
              <KpiFields initial={data} save={editable ? api.save : undefined} />
            </div>
          </div>
          <Section title={t('trend')}>
            <KpiTrend kpi={data} />
          </Section>
          <Section title={t('readings')}>
            <KpiReadings kpi={data} editable={editable} />
          </Section>
          <Section title={t('targets')}>
            <KpiTargets kpi={data} editable={editable} />
          </Section>
        </>
      )}
      <KpiFooter
        updatedAt={data?.updatedAt ?? kpi.updatedAt}
        remove={editable ? api.remove : null}
      />
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t pt-4">
      <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
// Freshness at the start, the destructive action at the end, out of the way of the record but
// still one click away — the footer every other entity closes with.
function KpiFooter({ updatedAt, remove }: { updatedAt: string; remove: (() => void) | null }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const dateTime = useDateTime();
  const relative = useRelativeTime();
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-xs text-text-muted">
      <span title={dateTime(updatedAt)}>{t('updated', { date: relative(updatedAt) })}</span>
      {remove && (
        <Button
          variant="ghost"
          size="sm"
          className="text-text-muted hover:text-danger focus-visible:text-danger"
          onClick={remove}
        >
          <Trash2 className="size-3.5" />
          {c('delete')}
        </Button>
      )}
    </footer>
  );
}
