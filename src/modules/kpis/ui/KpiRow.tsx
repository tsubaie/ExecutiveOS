'use client';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Sparkline } from '@/ui/charts/Sparkline';
import { useKpiLabels } from './use-kpi-labels';
import type { Kpi } from '../schema/validation';
// KPIS-B07: one line that answers "is this on track, and by how much". The dot ranks the row and
// the word beside it carries the state, so nothing here depends on colour being seen.
export function KpiRow({ kpi }: { kpi: Kpi }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const objective = kpi.objectiveName
    ? kpi.objectiveDeleted
      ? t('archivedObjective', { name: kpi.objectiveName })
      : kpi.objectiveName
    : null;
  const context = [kpi.category, objective, kpi.ownerName].filter(Boolean).join(' · ');
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span
        aria-hidden={true}
        className={cn('size-2 shrink-0 rounded-full', labels.dot(kpi.meta.status))}
      />
      <span className="grid min-w-0 gap-1">
        <span dir="auto" className="line-clamp-2 text-sm font-medium whitespace-normal">
          {kpi.name}
        </span>
        {context && (
          <span dir="auto" className="truncate text-xs font-normal text-text-muted">
            {context}
          </span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
          labels.chip(kpi.meta.status),
        )}
      >
        {labels.status(kpi.meta.status)}
      </span>
    </span>
  );
}
// The figures sit at the trailing edge: the reading, what it is measured against, and the move
// since the one before it. The spark only shows the shape; every number it draws is written here.
export function KpiTrail({ kpi }: { kpi: Kpi }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const { meta } = kpi;
  return (
    <span className="flex items-center gap-3 text-xs text-text-muted">
      {meta.percentChange !== null && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 tabular-nums',
            labels.changeInk(meta.percentChange, kpi.direction),
          )}
        >
          {meta.percentChange !== 0 &&
            (meta.percentChange > 0 ? (
              <ArrowUp className="size-3" aria-hidden={true} />
            ) : (
              <ArrowDown className="size-3" aria-hidden={true} />
            ))}
          {labels.change(meta.percentChange)}
        </span>
      )}
      <span className="grid justify-items-end gap-0.5 text-end">
        <span className="text-sm font-semibold tabular-nums text-text">
          {meta.current === null ? t('noReading') : labels.value(meta.current, kpi.unit)}
        </span>
        {meta.effectiveTarget !== null && meta.effectiveTargetPeriod && (
          <span className="tabular-nums">
            {t('targetOf', {
              value: labels.value(meta.effectiveTarget, kpi.unit),
              quarter: labels.period(meta.effectiveTargetPeriod, kpi.frequency),
            })}
          </span>
        )}
      </span>
      {meta.sparkline.length > 1 && (
        <span className="hidden @2xl:inline">
          <Sparkline
            points={meta.sparkline}
            tone={labels.tone(meta.status)}
            label={t('trendOf', { name: kpi.name })}
          />
        </span>
      )}
    </span>
  );
}
