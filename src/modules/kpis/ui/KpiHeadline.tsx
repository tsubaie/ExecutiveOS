'use client';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Gauge } from '@/ui/charts/Gauge';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { Locale } from '@/core/config/defaults';
import { quarterOf } from '@/core/time/kpis';
import { usePlainDate, useToday } from '@/ui/format';
import { cn } from '@/ui/cn';
import { useKpiLabels } from './use-kpi-labels';
import type { KpiDetail } from '../schema/validation';
// KPIS-B03 and KPIS-B08: the one figure the record leads with, and the series behind it. The arc is
// a meter bent round the number rather than a dial; where a ratio would be meaningless the arc is
// dropped entirely and the status stands on its own, which is the honest reading of "no target".
export function KpiHeadline({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const { meta } = kpi;
  const spoken =
    meta.achievement === null
      ? labels.status(meta.status)
      : t('achievementOf', {
          percent: labels.percent(meta.achievement),
          status: labels.status(meta.status),
        });
  return (
    <section className="grid gap-4 rounded-xl border bg-surface-raised/50 px-5 py-4">
      <Gauge achievement={meta.achievement} tone={labels.tone(meta.status)} label={spoken}>
        {meta.achievement !== null && (
          <span className="text-3xl leading-none font-semibold">
            {labels.percent(meta.achievement)}
          </span>
        )}
        <span
          className={cn('rounded-full px-2 py-0.5 text-xs font-medium', labels.ink(meta.status))}
        >
          {labels.status(meta.status)}
        </span>
      </Gauge>
      <HeadlineFacts kpi={kpi} />
    </section>
  );
}
function HeadlineFacts({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const date = usePlainDate();
  const { meta } = kpi;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm @md:grid-cols-3">
      <Fact label={t('currentReading')}>
        {meta.current === null ? (
          <span className="text-text-muted">{t('noReading')}</span>
        ) : (
          <>
            <span className="tabular-nums">{labels.value(meta.current, kpi.unit)}</span>
            {meta.currentDate && (
              <time
                className="block text-xs font-normal text-text-muted"
                dateTime={meta.currentDate}
              >
                {date(meta.currentDate)}
              </time>
            )}
          </>
        )}
      </Fact>
      <Fact label={t('effectiveTarget')}>
        {meta.effectiveTarget === null || !meta.effectiveTargetLabel ? (
          <span className="text-text-muted">{t('no_target')}</span>
        ) : (
          <>
            <span className="tabular-nums">{labels.value(meta.effectiveTarget, kpi.unit)}</span>
            <span className="block text-xs font-normal text-text-muted">
              {labels.quarter(meta.effectiveTargetLabel)}
            </span>
          </>
        )}
      </Fact>
      {kpi.previousQuarter && (
        <Fact label={labels.quarter(kpi.previousQuarter.label)}>
          <span className="tabular-nums">
            {kpi.previousQuarter.value === null
              ? t('noReading')
              : labels.value(kpi.previousQuarter.value, kpi.unit)}
          </span>
          {kpi.previousQuarter.target !== null && (
            <span className="block text-xs font-normal tabular-nums text-text-muted">
              {t('targetOfShort', { value: labels.value(kpi.previousQuarter.target, kpi.unit) })}
            </span>
          )}
        </Fact>
      )}
    </dl>
  );
}
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  );
}
// KPIS-B08: the readings up to today against the target that applied in each reading's quarter.
export function KpiTrend({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const date = usePlainDate();
  const today = useToday();
  const locale = useLocale();
  const targets = new Map(
    kpi.targets.map((row) => [`${row.year}-${row.quarter}`, row.targetValue]),
  );
  const series: TrendPoint[] = kpi.readings
    .filter((reading) => reading.readingDate <= today)
    .map((reading) => {
      const quarter = quarterOf(reading.readingDate);
      return {
        date: reading.readingDate,
        value: reading.value,
        target: targets.get(`${quarter.year}-${quarter.quarter}`) ?? null,
      };
    })
    .reverse();
  if (series.length < 2) return <p className="text-sm text-text-muted">{t('notEnoughReadings')}</p>;
  return (
    <TrendChart
      series={series}
      rtl={locale === Locale.options[1]}
      labels={{
        date: t('date'),
        value: t('reading'),
        target: t('target'),
        caption: t('trendCaption', { name: kpi.name }),
      }}
      format={{ value: labels.decimal, date }}
    />
  );
}
