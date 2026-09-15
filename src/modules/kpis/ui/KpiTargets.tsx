'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useToday, useYear } from '@/ui/format';
import { periodOf, periodsPerYear, type Frequency } from '@/core/time/kpis';
import { useKpiLabels } from './use-kpi-labels';
import { useTargetMutations } from './queries';
import type { KpiDetail, Target } from '../schema/validation';
const periodsOf = (frequency: Frequency) =>
  Array.from({ length: periodsPerYear(frequency) }, (_, index) => index + 1);
// KPIS-B05 and KPIS-B08: targets are set a year at a time, because that is how a plan is written.
// The inputs run in period order — twelve months, four quarters or the year itself — so the tab key
// walks the year the way the KPI is reported.
//
// The form is also the display: it shows every target the chosen year holds, so a table underneath
// would print the same numbers a second time. Clearing an input and saving removes that period's
// target, which is how a target is taken back without a separate delete control per cell.
export function KpiTargets({ kpi, editable }: { kpi: KpiDetail; editable: boolean }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const today = useToday();
  const periods = periodsOf(kpi.frequency);
  const mutations = useTargetMutations(kpi.id);
  const [chosen, setChosen] = useState(periodOf(today, kpi.frequency).year);
  const [draft, setDraft] = useState(() =>
    valuesFor(kpi.targets, periodOf(today, kpi.frequency).year, periods),
  );
  const years = [...new Set([...kpi.targets.map((target) => target.year), chosen])].sort(
    (a, b) => a - b,
  );
  const save = useMutation({
    mutationFn: async () => {
      const wanted = periods
        .map((period) => ({ year: chosen, period, targetValue: Number(draft[period - 1]) }))
        .filter((item) => draft[item.period - 1] !== '' && Number.isFinite(item.targetValue));
      // A cleared input on a period that still has a target is a target being taken back.
      const cleared = kpi.targets.filter(
        (target) => target.year === chosen && draft[target.period - 1] === '',
      );
      for (const target of cleared) await mutations.remove(target.id);
      if (wanted.length) await mutations.put({ items: wanted });
    },
  });
  function pick(next: number) {
    setChosen(next);
    setDraft(valuesFor(kpi.targets, next, periods));
  }
  if (!editable) return <TargetsRead kpi={kpi} years={years} periods={periods} />;
  return (
    <form
      aria-busy={save.isPending}
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <YearSwitcher chosen={chosen} pick={pick} />
      <div className="flex flex-wrap items-end gap-3">
        <PeriodInputs frequency={kpi.frequency} periods={periods} draft={draft} change={setDraft} />
        <Button type="submit" disabled={save.isPending}>
          {t('setYear')}
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        {t('targetsHint', { unit: labels.unit(kpi.unit).toLocaleLowerCase() })}
      </p>
      <div role="status">{save.error && <ErrorPanel error={save.error} />}</div>
    </form>
  );
}
// The year the plan covers, stepped one at a time. It used to be a stack of year chips beside a
// labelled number box, which put three controls of three different heights on one line and left the
// label floating over the chips. A stepper is one control the width of the number it holds: the
// figure sits between its two arrows and nothing above it has to be aligned to.
function YearSwitcher({ chosen, pick }: { chosen: number; pick: (year: number) => void }) {
  const t = useTranslations('kpis');
  const year = useYear();
  return (
    <div
      role="group"
      aria-label={t('year')}
      className="inline-flex items-center gap-0.5 justify-self-start rounded-lg border p-0.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('previousYear')}
        className="size-7 px-0 text-text-muted"
        onClick={() => pick(chosen - 1)}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden={true} />
      </Button>
      {/* The figure is what changes when an arrow is pressed, so it is what is announced. */}
      <span role="status" className="min-w-14 text-center text-sm font-medium tabular-nums">
        {year(chosen)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('nextYear')}
        className="size-7 px-0 text-text-muted"
        onClick={() => pick(chosen + 1)}
      >
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden={true} />
      </Button>
    </div>
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
              autoComplete="off"
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
// A deleted KPI keeps its plan on show without offering to change it.
function TargetsRead({
  kpi,
  years,
  periods,
}: {
  kpi: KpiDetail;
  years: number[];
  periods: number[];
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const year = useYear();
  if (!kpi.targets.length) return <p className="text-sm text-text-muted">{t('noTargets')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('targetsCaption', { name: kpi.name })}</caption>
        <thead className="text-xs text-text-muted">
          <tr>
            <th scope="col" className="px-2 py-2 text-start font-normal">
              {t('year')}
            </th>
            {periods.map((period) => (
              <th key={period} scope="col" className="px-2 py-2 text-end font-normal">
                {labels.periodShort(period, kpi.frequency)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((row) => (
            <tr key={row} className="border-t">
              <th scope="row" className="px-2 py-2 text-start font-normal tabular-nums">
                {year(row)}
              </th>
              {periods.map((period) => {
                const target = kpi.targets.find(
                  (item) => item.year === row && item.period === period,
                );
                return (
                  <td key={period} className="px-2 py-2 text-end whitespace-nowrap tabular-nums">
                    {target ? (
                      labels.value(target.targetValue, kpi.unit)
                    ) : (
                      <span className="text-text-muted">{t('unset')}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function valuesFor(targets: Target[], year: number, periods: number[]) {
  return periods.map((period) => {
    const match = targets.find((target) => target.year === year && target.period === period);
    return match ? String(match.targetValue) : '';
  });
}
