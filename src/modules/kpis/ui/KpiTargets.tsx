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
import { quarterOf } from '@/core/time/kpis';
import { useKpiLabels } from './use-kpi-labels';
import { useTargetMutations } from './queries';
import type { KpiDetail, Target } from '../schema/validation';
const QUARTERS = [1, 2, 3, 4];
type Remove = (targetId: string) => void;
// KPIS-B05 and KPIS-B08: targets are set a year at a time, because that is how a plan is written.
// The four inputs are one row in quarter order, so the tab key walks Q1 to Q4.
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
  const [chosen, setChosen] = useState(quarterOf(today).year);
  const [draft, setDraft] = useState(() => valuesFor(kpi.targets, quarterOf(today).year));
  const save = useMutation({
    mutationFn: () => {
      const items = QUARTERS.map((quarter) => ({
        year: chosen,
        quarter,
        targetValue: Number(draft[quarter - 1]),
      })).filter((item) => draft[item.quarter - 1] !== '' && Number.isFinite(item.targetValue));
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
      <div className="grid items-end gap-3 @md:grid-cols-[7rem_repeat(4,minmax(0,1fr))_auto]">
        <Field label={t('year')}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1900}
              max={2999}
              value={chosen}
              onChange={(event) => {
                const year = Number(event.target.value);
                setChosen(year);
                setDraft(valuesFor(kpi.targets, year));
              }}
            />
          )}
        </Field>
        <QuarterInputs draft={draft} change={setDraft} />
        <Button type="submit" disabled={save.isPending}>
          {t('setYear')}
        </Button>
      </div>
      {save.error && <ErrorPanel error={save.error} />}
    </form>
  );
}
function QuarterInputs({
  draft,
  change,
}: {
  draft: string[];
  change: (next: (values: string[]) => string[]) => void;
}) {
  const t = useTranslations('kpis');
  return (
    <>
      {QUARTERS.map((quarter) => (
        <Field key={quarter} label={t('quarterShort', { quarter })}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={draft[quarter - 1]}
              onChange={(event) =>
                change((values) =>
                  values.map((value, index) =>
                    index === quarter - 1 ? event.target.value : value,
                  ),
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
  const year = useYear();
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('targetsCaption', { name: kpi.name })}</caption>
      <thead className="text-xs text-text-muted">
        <tr>
          <th scope="col" className="py-2 text-start font-normal">
            {t('year')}
          </th>
          {QUARTERS.map((quarter) => (
            <th key={quarter} scope="col" className="py-2 text-end font-normal">
              {t('quarterShort', { quarter })}
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
            {QUARTERS.map((quarter) => (
              <TargetCell key={quarter} kpi={kpi} year={row} quarter={quarter} remove={remove} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function TargetCell({
  kpi,
  year,
  quarter,
  remove,
}: {
  kpi: KpiDetail;
  year: number;
  quarter: number;
  remove?: Remove | undefined;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const digits = useYear();
  const target = kpi.targets.find((item) => item.year === year && item.quarter === quarter);
  if (!target)
    return (
      <td className="py-2 text-end text-text-muted">
        <span>{t('unset')}</span>
      </td>
    );
  return (
    <td className="py-2 text-end tabular-nums">
      <span className="inline-flex items-center gap-1">
        {labels.value(target.targetValue, kpi.unit)}
        {remove && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('deleteTarget', { quarter, year: digits(year) })}
            onClick={() => remove(target.id)}
          >
            <Trash2 className="size-3.5" aria-hidden={true} />
          </Button>
        )}
      </span>
    </td>
  );
}
function valuesFor(targets: Target[], year: number) {
  return QUARTERS.map((quarter) => {
    const match = targets.find((target) => target.year === year && target.quarter === quarter);
    return match ? String(match.targetValue) : '';
  });
}
