'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Gauge } from '@/ui/charts/Gauge';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { Locale } from '@/core/config/defaults';
import { periodOf, type Frequency } from '@/core/time/kpis';
import { usePlainDate, useToday } from '@/ui/format';
import { cn } from '@/ui/cn';
import { useKpiLabels } from './use-kpi-labels';
import type { KpiDetail, PeriodView } from '../schema/validation';
// KPIS-B03 and KPIS-B08: the one figure the record leads with. The arc is a meter bent round the
// number rather than a dial, and it spans between the two figures it compares: where the measure
// stands, under one foot, and what it is being read against, under the other. Where a ratio would
// be meaningless the arc is dropped entirely and the status stands on its own, which is the honest
// reading of "no target".
//
// The period is a choice, because a target is: the toggle moves the comparison to the period before
// the one this KPI is measured against, or the one after it, and everything the arc says moves with
// it. The periods are the KPI's own — months, quarters or years — and the toggle carries the dates,
// so the figures under the arc do not repeat them. It opens on the effective period, so the record
// starts on the same answer the row the reader came from was showing.
export function KpiHeadline({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const [chosen, setChosen] = useState(1);
  const view = kpi.periods[chosen] ?? kpi.periods[1];
  if (!view) return null;
  const spoken =
    view.achievement === null
      ? labels.status(view.status)
      : t('achievementOf', {
          percent: labels.percent(view.achievement),
          status: labels.status(view.status),
        });
  return (
    <div className="grid justify-items-center gap-3">
      <Gauge
        achievement={view.achievement}
        tone={labels.tone(view.status)}
        label={spoken}
        start={
          <Foot
            label={t('currentReading')}
            value={kpi.meta.current === null ? null : labels.value(kpi.meta.current, kpi.unit)}
            empty={t('noReading')}
          />
        }
        end={
          <Foot
            label={t('effectiveTarget')}
            value={view.target === null ? null : labels.value(view.target, kpi.unit)}
            empty={t('unset')}
          />
        }
      >
        {view.achievement !== null && (
          <span className="text-3xl leading-none font-semibold">
            {labels.percent(view.achievement)}
          </span>
        )}
        <span
          className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', labels.chip(view.status))}
        >
          {labels.status(view.status)}
        </span>
      </Gauge>
      <PeriodToggle
        periods={kpi.periods}
        frequency={kpi.frequency}
        chosen={chosen}
        choose={setChosen}
      />
    </div>
  );
}
// One figure under one foot of the arc: what it is, and the number.
function Foot({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-text-muted">{label}</span>
      <span className={cn('text-sm font-medium', value === null && 'text-text-muted')}>
        {value ?? empty}
      </span>
    </span>
  );
}
function PeriodToggle({
  periods,
  frequency,
  chosen,
  choose,
}: {
  periods: PeriodView[];
  frequency: Frequency;
  chosen: number;
  choose: (index: number) => void;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  return (
    <div
      role="group"
      aria-label={t('measuredAgainst')}
      className="inline-flex rounded-lg border p-0.5"
    >
      {periods.map((period, index) => (
        <Button
          key={`${period.year}-${period.period}`}
          variant="ghost"
          size="sm"
          aria-pressed={index === chosen}
          className={cn(
            'h-7 px-2.5 text-xs font-normal text-text-muted',
            index === chosen && 'bg-surface-raised font-medium text-text',
          )}
          onClick={() => choose(index)}
        >
          {labels.period(period, frequency)}
        </Button>
      ))}
    </div>
  );
}
// KPIS-B04: the period before this one, read at its own last reading rather than at today's.
export function PreviousPeriod({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  if (!kpi.previousPeriod) return null;
  const { value, target, ...period } = kpi.previousPeriod;
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 text-sm">
      <span className="text-text-muted">{t('previousPeriod')}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular-nums">
          {value === null ? t('noReading') : labels.value(value, kpi.unit)}
        </span>
        <span className="text-xs text-text-muted">{labels.period(period, kpi.frequency)}</span>
        {target !== null && (
          <span className="text-xs text-text-muted">
            {t('targetOfShort', { value: labels.value(target, kpi.unit) })}
          </span>
        )}
      </span>
    </div>
  );
}
// KPIS-B08: the readings up to today as columns, against the target that applied in each reading's
// own period. The axis is labelled at the KPI's cadence, so a monthly measure reads in months.
export function KpiTrend({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const date = usePlainDate();
  const today = useToday();
  const locale = useLocale();
  const targets = new Map(kpi.targets.map((row) => [`${row.year}-${row.period}`, row.targetValue]));
  // One column per reporting period, not per reading: a period is what a target belongs to and what
  // the axis is labelled in, so several readings inside one month or quarter are that period's
  // latest figure rather than three columns sharing a name. Readings arrive newest first, so the
  // first one seen for a period is the one that stands for it.
  const byPeriod = new Map<string, TrendPoint>();
  for (const reading of kpi.readings) {
    if (reading.readingDate > today) continue;
    const period = periodOf(reading.readingDate, kpi.frequency);
    const key = `${period.year}-${period.period}`;
    if (byPeriod.has(key)) continue;
    byPeriod.set(key, {
      date: reading.readingDate,
      label: labels.period(period, kpi.frequency),
      value: reading.value,
      target: targets.get(key) ?? null,
    });
  }
  const series: TrendPoint[] = [...byPeriod.values()].reverse();
  if (!series.length) return <p className="text-sm text-text-muted">{t('notEnoughReadings')}</p>;
  return (
    <TrendChart
      series={series}
      tone={labels.tone(kpi.meta.status)}
      rtl={locale === Locale.options[1]}
      labels={{
        date: t('date'),
        value: t('reading'),
        target: t('target'),
        caption: t('trendCaption', { name: kpi.name }),
      }}
      format={{ value: (amount) => labels.value(amount, kpi.unit), date }}
    />
  );
}
