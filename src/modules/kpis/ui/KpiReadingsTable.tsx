'use client';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { usePlainDate } from '@/ui/format';
import { useKpiLabels } from './use-kpi-labels';
import { useReadingMutations } from './queries';
import type { KpiDetail, Reading } from '../schema/validation';
export function ReadingsTable({
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
          <th scope="col" className="px-2 py-2 text-start font-normal">
            {t('date')}
          </th>
          <th scope="col" className="px-2 py-2 text-end font-normal">
            {t('reading')}
          </th>
          <th scope="col" className="px-2 py-2 text-start font-normal">
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
// The note is the only part of a reading that is edited in place, so it carries its own save and
// wears the record's quiet chrome: text until the pointer or the keyboard arrives on it.
function ReadingNote({
  kpiId,
  reading,
  editable,
}: {
  kpiId: string;
  reading: Reading;
  editable: boolean;
}) {
  const t = useTranslations('kpis');
  const mutations = useReadingMutations(kpiId);
  if (!editable)
    return (
      <span dir="auto" className="text-text-muted">
        {reading.note}
      </span>
    );
  return (
    // No `property-empty` here: that rule keeps an outline round an empty text field so a label is
    // not left standing over a void, and in a table the column header is the label.
    <span className="property-quiet">
      <Input
        aria-label={t('note')}
        dir="auto"
        autoComplete="off"
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
    </span>
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
  return (
    <tr className="hover-reveal border-t">
      <td className="px-2 py-2 whitespace-nowrap">
        <time dateTime={reading.readingDate}>{date(reading.readingDate)}</time>
        {reading.future && (
          <span className="ms-2 rounded-full bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            {t('futureReading')}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-end whitespace-nowrap tabular-nums">
        {labels.value(reading.value, kpi.unit)}
      </td>
      <td className="px-2 py-2">
        <ReadingNote kpiId={kpi.id} reading={reading} editable={editable} />
      </td>
      {editable && (
        <td className="px-2 py-2 text-end">
          <span className="hover-reveal-target">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('deleteReading', { date: date(reading.readingDate) })}
              onClick={() => remove(reading.id)}
            >
              <Trash2 className="size-4" aria-hidden={true} />
            </Button>
          </span>
        </td>
      )}
    </tr>
  );
}
