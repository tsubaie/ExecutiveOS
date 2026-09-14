'use client';
import { useTranslations } from 'next-intl';
import { Tabs } from '@base-ui/react/tabs';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { DetailApi } from '@/ui/entity/types';
import { KpiHeadline, KpiTrend } from './KpiHeadline';
import { KpiReadings } from './KpiReadings';
import { KpiTargets } from './KpiTargets';
import { KpiFields } from './KpiFields';
import { useKpi } from './queries';
import type { Kpi, KpiPatch } from '../schema/validation';
const tabs: Array<'readings' | 'targets' | 'details'> = ['readings', 'targets', 'details'];
// KPIS-B08: the record leads with the answer — the gauge and the figures behind it — then the
// series, then the two tables the measure is maintained from. The properties sit last: a KPI is
// read far more often than its definition is edited (EP-B25).
export function KpiRecord({ kpi, api }: { kpi: Kpi; api: DetailApi<Omit<KpiPatch, 'revision'>> }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const record = useKpi(kpi.id, Boolean(kpi.deletedAt));
  const data = record.data;
  const editable = !kpi.deletedAt;
  return (
    <div className="@container space-y-5">
      <h2 tabIndex={-1} dir="auto" className="text-xl font-semibold">
        {kpi.name}
      </h2>
      {kpi.deletedAt && <Button onClick={api.restore}>{c('restore')}</Button>}
      {record.error && <ErrorPanel error={record.error} />}
      {!data ? (
        <p role="status">{c('loading')}</p>
      ) : (
        <>
          <KpiHeadline kpi={data} />
          <section className="rounded-xl border px-4 py-4">
            <h3 className="mb-3 text-sm font-medium">{t('trend')}</h3>
            <KpiTrend kpi={data} />
          </section>
          <Tabs.Root defaultValue="readings">
            <Tabs.List aria-label={t('measurement')} className="mb-4 flex gap-2 border-b">
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab}
                  value={tab}
                  className="border-b-2 border-transparent px-3 py-2 text-sm data-active:border-accent data-active:text-accent"
                >
                  {t(tab)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="readings">
              <KpiReadings kpi={data} editable={editable} />
            </Tabs.Panel>
            <Tabs.Panel value="targets">
              <KpiTargets kpi={data} editable={editable} />
            </Tabs.Panel>
            <Tabs.Panel value="details">
              <KpiFields initial={data} save={editable ? api.save : undefined} />
            </Tabs.Panel>
          </Tabs.Root>
        </>
      )}
      {editable && (
        <Button variant="ghost" className="text-danger" onClick={api.remove}>
          {c('delete')}
        </Button>
      )}
    </div>
  );
}
