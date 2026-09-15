'use client';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import type { Column } from '@/ui/entity/types';
import type { Kpi } from '../schema/validation';
import { useKpiLabels } from './use-kpi-labels';
// EP-B29: the tile's arc answers "how far through this one is" at a glance; a column answers "how
// do these seven compare", which is the question a table exists for. Every figure the arc stood in
// for is here as a number, read down its own column against the others.
function StatusCell({ kpi }: { kpi: Kpi }) {
  const labels = useKpiLabels();
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-xs font-medium', labels.chip(kpi.meta.status))}
    >
      {labels.status(kpi.meta.status)}
    </span>
  );
}
function ChangeCell({ kpi }: { kpi: Kpi }) {
  const labels = useKpiLabels();
  const change = kpi.meta.percentChange;
  if (change === null) return null;
  return (
    <span className={labels.changeInk(change, kpi.direction)}>{labels.change(change)}</span>
  );
}
export function useKpiColumns(): Column<Kpi>[] {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const value = (amount: number | null, kpi: Kpi) =>
    amount === null ? null : labels.value(amount, kpi.unit);
  return [
    {
      key: 'name',
      head: t('name'),
      primary: true,
      cell: (kpi) => (
        <span dir="auto" className="line-clamp-2 font-medium">
          {kpi.name}
        </span>
      ),
    },
    { key: 'status', head: t('statusColumn'), cell: (kpi) => <StatusCell kpi={kpi} /> },
    {
      key: 'current',
      head: t('currentReading'),
      numeric: true,
      cell: (kpi) => value(kpi.meta.current, kpi) ?? t('noReading'),
    },
    {
      key: 'target',
      head: t('effectiveTarget'),
      numeric: true,
      cell: (kpi) => value(kpi.meta.effectiveTarget, kpi),
    },
    {
      key: 'achievement',
      head: t('achievement'),
      numeric: true,
      cell: (kpi) => kpi.meta.achievement !== null && labels.percent(kpi.meta.achievement),
    },
    { key: 'change', head: t('change'), numeric: true, cell: (kpi) => <ChangeCell kpi={kpi} /> },
    {
      key: 'objective',
      head: t('objective'),
      cell: (kpi) => (
        <span dir="auto" className="truncate">
          {kpi.objectiveName}
        </span>
      ),
    },
  ];
}
