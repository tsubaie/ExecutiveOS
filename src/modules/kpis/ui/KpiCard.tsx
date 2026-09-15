'use client';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/ui/cn';
import { MeterArc } from '@/ui/layout/Meter';
import { useKpiLabels } from './use-kpi-labels';
import type { Kpi } from '../schema/validation';
// KPIS-B07: a scorecard tile answers four questions in the order a principal asks them. Which
// measure is this; how far through its target is it; what does it actually read against what was
// promised, and which way has it moved since the last reading. Who holds it is not one of them at
// this distance: an owner is read once a measure has been opened, and a name on every tile is a
// column of proper nouns between the eye and the figures.
//
// The instrument is an arc rather than a row of figures because the answer is a proportion, and a
// column of arcs is scanned without reading anything: the short ones are the ones to open. The
// status rides the arc, the word beside it and a bar down the tile's start edge — never the whole
// tile. Painting every card its own status colour is the obvious executive look and it defeats
// itself: when all seven shout, the eye has nothing left to catch on, and white text on a
// saturated ground gives up the contrast the status scale was measured to hold (src/ui/tokens.css).
// The surface stays neutral so the marks can carry the state.
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const objective = kpi.objectiveName
    ? kpi.objectiveDeleted
      ? t('archivedObjective', { name: kpi.objectiveName })
      : kpi.objectiveName
    : null;
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-4">
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="grid min-w-0 gap-1">
          <span dir="auto" className="line-clamp-2 text-[15px] leading-snug font-medium">
            {kpi.name}
          </span>
          {objective && (
            <span dir="auto" className="truncate text-xs text-text-muted">
              {objective}
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
      <span className="mt-auto flex items-center gap-4">
        <KpiDial kpi={kpi} />
        <KpiFigures kpi={kpi} />
      </span>
    </span>
  );
}
// How far through the target, as the mark and as the figure inside it. A measure with no target
// has no proportion to draw, so the arc stays an empty track and says so rather than reading as
// zero — which is a different and much worse answer.
function KpiDial({ kpi }: { kpi: Kpi }) {
  const labels = useKpiLabels();
  const { achievement, status } = kpi.meta;
  return (
    <span className="relative grid size-[68px] shrink-0 place-items-center">
      <MeterArc ratio={achievement} tone={labels.tone(status)} className="absolute inset-0" />
      <span
        className={cn(
          'text-sm leading-none font-semibold tabular-nums',
          achievement === null && 'text-text-muted',
        )}
      >
        {achievement === null ? '—' : labels.percent(achievement)}
      </span>
    </span>
  );
}
// The reading, what it was measured against, and the move since the one before it. The figure is
// the largest thing in the tile and takes the font's proportional digits: `tabular-nums` gives
// every digit the width of a zero, which reads as loose spacing at this size. The small figures
// under it keep them, because a column of tiles lines those up.
function KpiFigures({ kpi }: { kpi: Kpi }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const { meta } = kpi;
  return (
    <span className="grid min-w-0 gap-1">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            'text-2xl leading-none font-semibold',
            meta.current === null && 'text-base text-text-muted',
          )}
        >
          {meta.current === null ? t('noReading') : labels.value(meta.current, kpi.unit)}
        </span>
        <KpiChange kpi={kpi} />
      </span>
      <span className="truncate text-xs text-text-muted tabular-nums">
        {meta.effectiveTarget === null || meta.effectiveTargetPeriod === null
          ? t('no_target')
          : t('targetOf', {
              value: labels.value(meta.effectiveTarget, kpi.unit),
              quarter: labels.period(meta.effectiveTargetPeriod, kpi.frequency),
            })}
      </span>
    </span>
  );
}
// A change is good or bad by the direction the KPI is meant to move, never by its sign.
function KpiChange({ kpi }: { kpi: Kpi }) {
  const labels = useKpiLabels();
  const change = kpi.meta.percentChange;
  if (change === null) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs tabular-nums',
        labels.changeInk(change, kpi.direction),
      )}
    >
      {change !== 0 &&
        (change > 0 ? (
          <ArrowUp className="size-3" aria-hidden={true} />
        ) : (
          <ArrowDown className="size-3" aria-hidden={true} />
        ))}
      {labels.change(change)}
    </span>
  );
}
