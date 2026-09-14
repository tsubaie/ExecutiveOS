'use client';
import { useTranslations } from 'next-intl';
import { useCount, useDecimal, usePercent, useSignedPercent, useYear } from '@/ui/format';
import { parseQuarterLabel } from '@/core/time/kpis';
import type { GaugeTone } from '@/ui/charts/Gauge';
import type { Direction, KpiStatus } from '../schema/validation';
// One vocabulary for the scorecard's states. Status never travels as colour alone: every place
// that paints a dot also prints the word, and the tone only ranks what the word already says.
const tones: Record<KpiStatus, GaugeTone> = {
  on_target: 'positive',
  near_target: 'caution',
  off_target: 'negative',
  no_data: 'neutral',
  stale: 'neutral',
  no_target: 'neutral',
};
const dots: Record<GaugeTone, string> = {
  positive: 'bg-success',
  caution: 'bg-warning',
  negative: 'bg-danger',
  neutral: 'bg-text-muted',
};
const inks: Record<GaugeTone, string> = {
  positive: 'text-success',
  caution: 'text-warning',
  negative: 'text-danger',
  neutral: 'text-text-muted',
};
export function useKpiLabels() {
  const t = useTranslations('kpis');
  const decimal = useDecimal();
  const percent = usePercent();
  const signed = useSignedPercent();
  const count = useCount();
  const year = useYear();
  // A unit belongs to its value, so the two are joined by the catalog rather than concatenated.
  const value = (amount: number, unit: string) =>
    unit ? t('valueWithUnit', { value: decimal(amount), unit }) : decimal(amount);
  return {
    status: (status: KpiStatus) => t(status),
    tone: (status: KpiStatus) => tones[status],
    dot: (status: KpiStatus) => dots[tones[status]],
    ink: (status: KpiStatus) => inks[tones[status]],
    value,
    decimal,
    percent,
    // A change is good or bad depending on which way the KPI is meant to move, so the ink follows
    // the direction and not the sign.
    changeInk: (change: number, direction: Direction) =>
      change === 0
        ? inks.neutral
        : change > 0 === (direction === 'higher')
          ? inks.positive
          : inks.negative,
    change: signed,
    quarter: (label: string) => {
      const quarter = parseQuarterLabel(label);
      return quarter
        ? t('quarterLabel', { quarter: count(quarter.quarter), year: year(quarter.year) })
        : label;
    },
  };
}
