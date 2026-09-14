'use client';
import { useTranslations } from 'next-intl';
import { DollarSign, Hash, Percent, SaudiRiyal, Star, type LucideIcon } from 'lucide-react';
import {
  useCount,
  useDecimal,
  useMonth,
  useMonthYear,
  usePercent,
  useSignedPercent,
  useYear,
} from '@/ui/format';
import type { Frequency, Period } from '@/core/time/kpis';
import type { ChartTone } from '@/ui/charts/tokens';
import type { Direction, KpiStatus, Unit } from '../schema/validation';
// One vocabulary for the scorecard's states. Status never travels as colour alone: every place
// that paints a dot also prints the word, and the tone only ranks what the word already says.
const tones: Record<KpiStatus, ChartTone> = {
  on_target: 'positive',
  near_target: 'caution',
  off_target: 'negative',
  no_data: 'neutral',
  stale: 'neutral',
  no_target: 'neutral',
};
const dots: Record<ChartTone, string> = {
  positive: 'bg-status-good',
  caution: 'bg-status-warn',
  negative: 'bg-status-bad',
  neutral: 'bg-text-muted',
};
// Words take the ink variant of the scale; marks take the scale itself (src/ui/tokens.css).
const inks: Record<ChartTone, string> = {
  positive: 'text-status-good-ink',
  caution: 'text-status-warn-ink',
  negative: 'text-status-bad-ink',
  neutral: 'text-text-muted',
};
// The chip is the status colour at a low alpha over whatever surface it lands on, so one token
// gives both the wash and the word and the pair always belongs to the same hue.
const chips: Record<ChartTone, string> = {
  positive: 'bg-status-good/15 text-status-good-ink',
  caution: 'bg-status-warn/15 text-status-warn-ink',
  negative: 'bg-status-bad/15 text-status-bad-ink',
  neutral: 'bg-surface-raised text-text-muted',
};
// A unit is a closed list, so each one can carry the symbol a reader recognizes.
export const unitIcons: Record<Unit, LucideIcon> = {
  count: Hash,
  percent: Percent,
  sar: SaudiRiyal,
  usd: DollarSign,
  points: Star,
};
const unitNames: Record<Unit, 'unitCount' | 'unitPercent' | 'unitSar' | 'unitUsd' | 'unitPoints'> =
  {
    count: 'unitCount',
    percent: 'unitPercent',
    sar: 'unitSar',
    usd: 'unitUsd',
    points: 'unitPoints',
  };
const valueForms: Record<
  Unit,
  'valueCount' | 'valuePercent' | 'valueSar' | 'valueUsd' | 'valuePoints'
> = {
  count: 'valueCount',
  percent: 'valuePercent',
  sar: 'valueSar',
  usd: 'valueUsd',
  points: 'valuePoints',
};
// A period reads the way its cadence is spoken: a month by name, a quarter by number, a year alone.
export function usePeriodLabel() {
  const t = useTranslations('kpis');
  const count = useCount();
  const year = useYear();
  const monthYear = useMonthYear();
  return (period: Period, frequency: Frequency) => {
    if (frequency === 'annual') return year(period.year);
    if (frequency === 'monthly') return monthYear(period.year, period.period);
    return t('quarterLabel', { quarter: count(period.period), year: year(period.year) });
  };
}
// The same period without its year, for a column header or a compact axis tick.
export function usePeriodShort() {
  const t = useTranslations('kpis');
  const count = useCount();
  const month = useMonth();
  return (period: number, frequency: Frequency) => {
    if (frequency === 'annual') return t('annual');
    if (frequency === 'monthly') return month(period);
    return t('quarterShort', { quarter: count(period) });
  };
}
export function useKpiLabels() {
  const t = useTranslations('kpis');
  const decimal = useDecimal();
  const percent = usePercent();
  const signed = useSignedPercent();
  const period = usePeriodLabel();
  const periodShort = usePeriodShort();
  // A unit belongs to its value, so the two are joined by the catalog rather than concatenated.
  const value = (amount: number, unit: Unit) => t(valueForms[unit], { value: decimal(amount) });
  return {
    status: (status: KpiStatus) => t(status),
    tone: (status: KpiStatus) => tones[status],
    dot: (status: KpiStatus) => dots[tones[status]],
    ink: (status: KpiStatus) => inks[tones[status]],
    chip: (status: KpiStatus) => chips[tones[status]],
    unit: (unit: Unit) => t(unitNames[unit]),
    value,
    decimal,
    percent,
    period,
    periodShort,
    // A change is good or bad depending on which way the KPI is meant to move, so the ink follows
    // the direction and not the sign.
    changeInk: (change: number, direction: Direction) =>
      change === 0
        ? inks.neutral
        : change > 0 === (direction === 'higher')
          ? inks.positive
          : inks.negative,
    change: signed,
  };
}
