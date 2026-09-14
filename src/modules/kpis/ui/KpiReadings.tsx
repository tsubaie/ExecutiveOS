'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { DatePicker } from '@/ui/layout/DatePicker';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { ApiError } from '@/core/http/client';
import { usePlainDate, useToday } from '@/ui/format';
import { useKpiLabels } from './use-kpi-labels';
import { useReadingMutations } from './queries';
import type { KpiDetail, Reading } from '../schema/validation';
// KPIS-B09: the date is the address of a reading, so a second reading for a day that already has
// one is a conflict the workspace resolves rather than a silent replacement. The overwrite is
// offered in place, with the value about to be written still on screen.
export function KpiReadings({ kpi, editable }: { kpi: KpiDetail; editable: boolean }) {
  const t = useTranslations('kpis');
  const mutations = useReadingMutations(kpi.id);
  const remove = useMutation({ mutationFn: (readingId: string) => mutations.remove(readingId) });
  return (
    <div className="grid gap-4">
      {editable && <ReadingForm kpi={kpi} />}
      {remove.error && <ErrorPanel error={remove.error} />}
      {kpi.readings.length === 0 ? (
        <p className="text-sm text-text-muted">{t('noReadings')}</p>
      ) : (
        <ReadingsTable kpi={kpi} editable={editable} remove={(id) => remove.mutate(id)} />
      )}
    </div>
  );
}
type Draft = { day: string; value: string; note: string };
function ReadingForm({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const date = usePlainDate();
  const today = useToday();
  const mutations = useReadingMutations(kpi.id);
  const [draft, setDraft] = useState<Draft>({ day: today, value: '', note: '' });
  const [clash, setClash] = useState(false);
  const add = useMutation({
    mutationFn: (overwrite: boolean) => {
      const value = Number(draft.value);
      if (draft.value === '' || !Number.isFinite(value)) throw new Error(c('error'));
      return overwrite
        ? mutations.overwrite(draft.day, { value, note: draft.note })
        : mutations.add({ readingDate: draft.day, value, note: draft.note });
    },
    onSuccess: () => {
      setClash(false);
      setDraft({ day: today, value: '', note: '' });
    },
    onError: (failure) => setClash(failure instanceof ApiError && failure.code === 'conflict'),
  });
  return (
    <div className="grid gap-3">
      <form
        className="grid items-end gap-3 @md:grid-cols-[auto_8rem_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(false);
        }}
      >
        <ReadingInputs draft={draft} today={today} change={setDraft} />
        <Button type="submit" disabled={add.isPending}>
          {t('addReading')}
        </Button>
      </form>
      {clash && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {t('duplicateReading', { date: date(draft.day) })}
          <Button variant="outline" size="sm" onClick={() => add.mutate(true)}>
            {t('overwriteReading')}
          </Button>
        </p>
      )}
      {add.error && !clash && <ErrorPanel error={add.error} />}
    </div>
  );
}
function ReadingInputs({
  draft,
  today,
  change,
}: {
  draft: Draft;
  today: string;
  change: (next: (value: Draft) => Draft) => void;
}) {
  const t = useTranslations('kpis');
  return (
    <>
      <Field label={t('date')}>
        {() => (
          <DatePicker
            label={t('date')}
            value={draft.day}
            onChange={(day) => change((value) => ({ ...value, day: day ?? today }))}
          />
        )}
      </Field>
      <Field label={t('reading')}>
        {(control) => (
          <Input
            {...control}
            required
            inputMode="decimal"
            value={draft.value}
            onChange={(event) => change((value) => ({ ...value, value: event.target.value }))}
          />
        )}
      </Field>
      <Field label={t('note')}>
        {(control) => (
          <Input
            {...control}
            dir="auto"
            maxLength={2000}
            value={draft.note}
            onChange={(event) => change((value) => ({ ...value, note: event.target.value }))}
          />
        )}
      </Field>
    </>
  );
}
function ReadingsTable({
  kpi,
  editable,
  remove,
}: {
  kpi: KpiDetail;
  editable: boolean;
  remove: (readingId: string) => void;
}) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('readingsCaption', { name: kpi.name })}</caption>
      <thead className="text-xs text-text-muted">
        <tr>
          <th scope="col" className="py-2 text-start font-normal">
            {t('date')}
          </th>
          <th scope="col" className="py-2 text-end font-normal">
            {t('reading')}
          </th>
          <th scope="col" className="py-2 text-start font-normal">
            {t('note')}
          </th>
          {editable && (
            <th scope="col" className="sr-only">
              {c('delete')}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {kpi.readings.map((reading) => (
          <ReadingRow
            key={reading.id}
            kpi={kpi}
            reading={reading}
            editable={editable}
            remove={remove}
          />
        ))}
      </tbody>
    </table>
  );
}
function ReadingRow({
  kpi,
  reading,
  editable,
  remove,
}: {
  kpi: KpiDetail;
  reading: Reading;
  editable: boolean;
  remove: (readingId: string) => void;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const date = usePlainDate();
  const mutations = useReadingMutations(kpi.id);
  return (
    <tr className="border-t">
      <td className="py-2 whitespace-nowrap">
        <time dateTime={reading.readingDate}>{date(reading.readingDate)}</time>
        {reading.future && (
          <span className="ms-2 rounded-full bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            {t('futureReading')}
          </span>
        )}
      </td>
      <td className="py-2 text-end tabular-nums">{labels.value(reading.value, kpi.unit)}</td>
      <td className="py-2">
        {editable ? (
          <Input
            aria-label={t('note')}
            dir="auto"
            maxLength={2000}
            defaultValue={reading.note}
            onBlur={(event) => {
              if (event.target.value !== reading.note)
                void mutations.patch(reading.id, {
                  revision: reading.revision,
                  note: event.target.value,
                });
            }}
          />
        ) : (
          <span dir="auto">{reading.note}</span>
        )}
      </td>
      {editable && (
        <td className="py-2 text-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('deleteReading', { date: date(reading.readingDate) })}
            onClick={() => remove(reading.id)}
          >
            <Trash2 className="size-4" aria-hidden={true} />
          </Button>
        </td>
      )}
    </tr>
  );
}
