'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useToday, useYear } from '@/ui/format';
import { periodOf, periodsPerYear, type Frequency } from '@/core/time/kpis';
import { useKpiLabels } from './use-kpi-labels';
import { useTargetMutations } from './queries';
import type { KpiDetail, Target } from '../schema/validation';
type Remove = (targetId: string) => void;
const periodsOf = (frequency: Frequency) =>
  Array.from({ length: periodsPerYear(frequency) }, (_, index) => index + 1);
// KPIS-B05 and KPIS-B08: targets are set a year at a time, because that is how a plan is written.
// The inputs run in period order — twelve months, four quarters or the year itself — so the tab key
// walks the year the way the KPI is actually reported.
export function KpiTargets({ kpi, editable }: { kpi: KpiDetail; editable: boolean }) {
  const t = useTranslations('kpis');
  const mutations = useTargetMutations(kpi.id);
  const remove = useMutation({ mutationFn: (targetId: string) => mutations.remove(targetId) });
  const years = [...new Set(kpi.targets.map((target) => target.year))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4">
      {editable && <TargetsForm kpi={kpi} />}
      {remove.error && <ErrorPanel error={remove.error} />}
      {years.length === 0 ? (
        <p className="text-sm text-text-muted">{t('noTargets')}</p>
      ) : (
        <TargetsTable
          kpi={kpi}
          years={years}
          remove={editable ? (targetId) => remove.mutate(targetId) : undefined}
        />
      )}
    </div>
  );
}
function TargetsForm({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const today = useToday();
  const mutations = useTargetMutations(kpi.id);
  const periods = periodsOf(kpi.frequency);
  const [chosen, setChosen] = useState(periodOf(today, kpi.frequency).year);
  const [draft, setDraft] = useState(() =>
    valuesFor(kpi.targets, periodOf(today, kpi.frequency).year, periods),
  );
  const save = useMutation({
    mutationFn: () => {
      const items = periods
        .map((period) => ({ year: chosen, period, targetValue: Number(draft[period - 1]) }))
        .filter((item) => draft[item.period - 1] !== '' && Number.isFinite(item.targetValue));
      if (!items.length) throw new Error(c('error'));
      return mutations.put({ items });
    },
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('year')}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1900}
              max={2999}
              className="w-24"
              value={chosen}
              onChange={(event) => {
                const year = Number(event.target.value);
                setChosen(year);
                setDraft(valuesFor(kpi.targets, year, periods));
              }}
            />
          )}
        </Field>
        <PeriodInputs frequency={kpi.frequency} periods={periods} draft={draft} change={setDraft} />
        <Button type="submit" disabled={save.isPending}>
          {t('setYear')}
        </Button>
      </div>
      {save.error && <ErrorPanel error={save.error} />}
    </form>
  );
}
function PeriodInputs({
  frequency,
  periods,
  draft,
  change,
}: {
  frequency: Frequency;
  periods: number[];
  draft: string[];
  change: (next: (values: string[]) => string[]) => void;
}) {
  const labels = useKpiLabels();
  return (
    <>
      {periods.map((period) => (
        <Field key={period} label={labels.periodShort(period, frequency)}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              className="w-20"
              value={draft[period - 1]}
              onChange={(event) =>
                change((values) =>
                  values.map((value, index) => (index === period - 1 ? event.target.value : value)),
                )
              }
            />
          )}
        </Field>
      ))}
    </>
  );
}
function TargetsTable({
  kpi,
  years,
  remove,
}: {
  kpi: KpiDetail;
  years: number[];
  remove?: Remove | undefined;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const year = useYear();
  const periods = periodsOf(kpi.frequency);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('targetsCaption', { name: kpi.name })}</caption>
        <thead className="text-xs text-text-muted">
          <tr>
            <th scope="col" className="py-2 text-start font-normal">
              {t('year')}
            </th>
            {periods.map((period) => (
              <th key={period} scope="col" className="py-2 text-end font-normal">
                {labels.periodShort(period, kpi.frequency)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((row) => (
            <tr key={row} className="border-t">
              <th scope="row" className="py-2 text-start font-normal tabular-nums">
                {year(row)}
              </th>
              {periods.map((period) => (
                <TargetCell key={period} kpi={kpi} year={row} period={period} remove={remove} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TargetCell({
  kpi,
  year,
  period,
  remove,
}: {
  kpi: KpiDetail;
  year: number;
  period: number;
  remove?: Remove | undefined;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const digits = useYear();
  const target = kpi.targets.find((item) => item.year === year && item.period === period);
  if (!target)
    return (
      <td className="py-2 text-end text-text-muted">
        <span>{t('unset')}</span>
      </td>
    );
  return (
    <td className="py-2 text-end whitespace-nowrap tabular-nums">
      <span className="inline-flex items-center gap-1">
        {labels.value(target.targetValue, kpi.unit)}
        {remove && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('deleteTarget', {
              quarter: labels.periodShort(period, kpi.frequency),
              year: digits(year),
            })}
            onClick={() => remove(target.id)}
          >
            <Trash2 className="size-3.5" aria-hidden={true} />
          </Button>
        )}
      </span>
    </td>
  );
}
function valuesFor(targets: Target[], year: number, periods: number[]) {
  return periods.map((period) => {
    const match = targets.find((target) => target.year === year && target.period === period);
    return match ? String(match.targetValue) : '';
  });
}
