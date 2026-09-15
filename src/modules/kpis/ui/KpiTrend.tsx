'use client';
import { useLocale, useTranslations } from 'next-intl';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { Locale } from '@/core/config/defaults';
import { periodIndex, periodOf, periodsPerYear, shiftPeriod } from '@/core/time/kpis';
import { useToday } from '@/ui/format';
import { useKpiLabels } from './use-kpi-labels';
import type { KpiDetail } from '../schema/validation';
// The most periods of history the trend will show. It shows fewer when the KPI is younger than
// that: a scorecard should not open with years of blank columns for a measure that started in June.
const HISTORY = 8;
// KPIS-B08: the reporting periods up to this one as columns, whether or not each was reported. A
// period nobody recorded is the thing a scorecard most needs to show, and dropping it would draw a
// tidy line through the gap — but only back to the first reading the KPI ever took. Empty columns
// before a measure existed are not a gap in the record, they are the record not having started.
// Each column is that period's latest reading; the dot over it is its target.
export function KpiTrend({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const today = useToday();
  const locale = useLocale();
  const targets = new Map(kpi.targets.map((row) => [`${row.year}-${row.period}`, row.targetValue]));
  const readings = new Map<string, number>();
  for (const reading of kpi.readings) {
    if (reading.readingDate > today) continue;
    const at = periodOf(reading.readingDate, kpi.frequency);
    const key = `${at.year}-${at.period}`;
    // Readings arrive newest first, so the first one seen in a period is the one that stands for it.
    if (!readings.has(key)) readings.set(key, reading.value);
  }
  const series: TrendPoint[] = span(kpi, today).map((at) => {
    const key = `${at.year}-${at.period}`;
    return {
      key,
      label: labels.period(at, kpi.frequency),
      value: readings.get(key) ?? null,
      target: targets.get(key) ?? null,
    };
  });
  if (!series.some((point) => point.value !== null))
    return <p className="text-sm text-text-muted">{t('notEnoughReadings')}</p>;
  return (
    <TrendChart
      series={series}
      tone={labels.tone(kpi.meta.status)}
      rtl={locale === Locale.options[1]}
      labels={{
        period: t('period'),
        value: t('reading'),
        target: t('target'),
        caption: t('trendCaption', { name: kpi.name }),
      }}
      format={{ value: (amount) => labels.value(amount, kpi.unit) }}
    />
  );
}
// The periods the trend covers. It runs to the end of the year being planned when targets reach
// that far, so a plan set for four quarters is read as four columns with the unreported ones still
// standing under their targets — the gap between what was planned and what has been reported is the
// chart's whole job. It reaches back to the oldest reading or target and never further, since blank
// columns from before a measure existed report a gap in a record that had not started, and it holds
// at most HISTORY columns, the newest ones.
function span(kpi: KpiDetail, today: string) {
  const current = periodOf(today, kpi.frequency);
  const now = periodIndex(current, kpi.frequency);
  const year = periodIndex(
    { year: current.year, period: periodsPerYear(kpi.frequency) },
    kpi.frequency,
  );
  const marks = [
    ...kpi.readings
      .filter((reading) => reading.readingDate <= today)
      .map((reading) => periodIndex(periodOf(reading.readingDate, kpi.frequency), kpi.frequency)),
    ...kpi.targets.map((target) => periodIndex(target, kpi.frequency)),
  ];
  const last = Math.min(Math.max(now, ...marks), year);
  const from = Math.max(Math.min(now, ...marks), last - (HISTORY - 1));
  return Array.from({ length: last - from + 1 }, (_, index) =>
    shiftPeriod(current, from + index - now, kpi.frequency),
  );
}
