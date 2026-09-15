'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { CirclePlus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { DatePicker } from '@/ui/layout/DatePicker';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { ApiError } from '@/core/http/client';
import { usePlainDate, useToday } from '@/ui/format';
import { useReadingMutations } from './queries';
import type { KpiDetail } from '../schema/validation';
import { ReadingsTable } from './KpiReadingsTable';
// KPIS-B09: the history is a record, not a form. Recording a reading is the owner's job and a rare
// one, so the form stays folded until it is asked for rather than standing between the reader and
// the numbers. A note reads as text and becomes an input on contact, the way every property in this
// panel does (EP-B25), and the delete stays out of sight until the row is hovered or focused.
export function KpiReadings({ kpi, editable }: { kpi: KpiDetail; editable: boolean }) {
  const t = useTranslations('kpis');
  const mutations = useReadingMutations(kpi.id);
  const [adding, setAdding] = useState(false);
  const remove = useMutation({ mutationFn: (readingId: string) => mutations.remove(readingId) });
  return (
    <div className="grid gap-4">
      {editable &&
        (adding ? (
          <ReadingForm kpi={kpi} close={() => setAdding(false)} />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setAdding(true)}
          >
            <CirclePlus className="size-4" aria-hidden={true} />
            {t('addReadingOpen')}
          </Button>
        ))}
      <div role="status">{remove.error && <ErrorPanel error={remove.error} />}</div>
      {kpi.readings.length === 0 ? (
        <p className="text-sm text-text-muted">{t('noReadings')}</p>
      ) : (
        <ReadingsTable kpi={kpi} editable={editable} remove={(id) => remove.mutate(id)} />
      )}
    </div>
  );
}
type Draft = { day: string; value: string; note: string };
function ReadingForm({ kpi, close }: { kpi: KpiDetail; close: () => void }) {
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
    onSuccess: close,
    onError: (failure) => setClash(failure instanceof ApiError && failure.code === 'conflict'),
  });
  return (
    <div className="grid gap-3 rounded-xl border px-3 py-3">
      <form
        aria-busy={add.isPending}
        className="grid items-end gap-3 @md:grid-cols-[auto_7rem_minmax(0,1fr)_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(false);
        }}
      >
        <ReadingInputs draft={draft} today={today} change={setDraft} />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? c('saving') : t('addReading')}
        </Button>
        <Button type="button" variant="ghost" onClick={close}>
          {c('cancel')}
        </Button>
      </form>
      <div role="status">
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
            autoComplete="off"
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
            autoComplete="off"
            maxLength={2000}
            value={draft.note}
            onChange={(event) => change((value) => ({ ...value, note: event.target.value }))}
          />
        )}
      </Field>
    </>
  );
}
