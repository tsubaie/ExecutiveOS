'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Gauge } from '@/ui/charts/Gauge';
import { type Frequency } from '@/core/time/kpis';
import { usePlainDate, useRelativeDay } from '@/ui/format';
import { cn } from '@/ui/cn';
import { useKpiLabels } from './use-kpi-labels';
import type { KpiDetail, PeriodView } from '../schema/validation';
// KPIS-B08: the answer in a sentence, before any mark. A chart confirms a reading; it is not where
// the reading should first be found, and a principal who opens a record wants to be told.
export function KpiSummary({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const ago = useRelativeDay();
  const view = kpi.periods[1];
  if (!view) return null;
  const period = labels.period(view, kpi.frequency);
  const value = kpi.meta.current;
  const age = kpi.meta.currentDate;
  const sentence =
    value === null || age === null
      ? t('summaryNoReading', { period })
      : view.target === null
        ? t('summaryNoTarget', { value: labels.value(value, kpi.unit), period, age: ago(age) })
        : t('summary', {
            value: labels.value(value, kpi.unit),
            target: labels.value(view.target, kpi.unit),
            period,
            status: labels.status(view.status).toLocaleLowerCase(),
            age: ago(age),
          });
  return <p className="text-sm text-text-muted">{sentence}</p>;
}
// KPIS-B03: the arc is a meter bent round the ratio it measures, spanning between the two figures
// it compares — where the measure stands, under one foot, and what it is being read against, under
// the other. The figure inside says what it is ("of target"): on a KPI whose unit is itself a
// percentage, a bare percentage in the middle reads as the measure and means the opposite.
//
// The period is a choice, because a target is: the toggle moves the comparison a period either way
// and everything the arc says moves with it. It opens on the effective period, so the record starts
// on the same answer the row the reader came from was showing.
//
// Stepping it is deliberately not a view transition (ADR 0021 covers the list, not this). Capturing
// this block would tear the gauge down and stand a new one up, and a chart that re-mounts reads as
// a chart that is loading — the one thing the reader must not think when they have only asked to
// compare a quarter. The arc animates between the two values in place instead, which is the
// movement that actually means something here: the mark travelling from one reading to the other.
export function KpiHeadline({ kpi }: { kpi: KpiDetail }) {
  const [chosen, setChosen] = useState(1);
  const view = kpi.periods[chosen] ?? kpi.periods[1];
  if (!view) return null;
  return (
    <div className="grid justify-items-center gap-3">
      <PeriodReading kpi={kpi} view={view} />
      <PeriodToggle
        periods={kpi.periods}
        frequency={kpi.frequency}
        chosen={chosen}
        choose={setChosen}
      />
    </div>
  );
}
// Everything the chosen period answers: the arc, the two figures it spans, and the status in words.
function PeriodReading({ kpi, view }: { kpi: KpiDetail; view: PeriodView }) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const spoken =
    view.achievement === null
      ? labels.status(view.status)
      : t('achievementOf', {
          percent: labels.percent(view.achievement),
          status: labels.status(view.status),
        });
  return (
    <>
      <Gauge
        achievement={view.achievement}
        tone={labels.tone(view.status)}
        label={spoken}
        start={
          <Foot
            label={t('currentReading')}
            value={kpi.meta.current === null ? null : labels.value(kpi.meta.current, kpi.unit)}
            empty={t('noReading')}
          />
        }
        end={
          <Foot
            label={t('effectiveTarget')}
            value={view.target === null ? null : labels.value(view.target, kpi.unit)}
            empty={t('unset')}
          />
        }
      >
        {view.achievement !== null && (
          <>
            <span className="text-3xl leading-none font-semibold">
              {labels.percent(view.achievement)}
            </span>
            <span className="text-[11px] text-text-muted">{t('ofTarget')}</span>
          </>
        )}
      </Gauge>
      <span
        className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', labels.chip(view.status))}
      >
        {labels.status(view.status)}
      </span>
    </>
  );
}
// One figure under one foot of the arc: what it is, and the number.
function Foot({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-text-muted">{label}</span>
      <span className={cn('text-sm font-medium', value === null && 'text-text-muted')}>
        {value ?? empty}
      </span>
    </span>
  );
}
function PeriodToggle({
  periods,
  frequency,
  chosen,
  choose,
}: {
  periods: PeriodView[];
  frequency: Frequency;
  chosen: number;
  choose: (index: number) => void;
}) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const group = useRef<HTMLDivElement>(null);
  // A segmented control is one stop on the tab ring and the arrows move within it, the way a set of
  // mutually exclusive options is expected to behave.
  function steer(event: React.KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + periods.length) % periods.length;
    choose(next);
    group.current?.querySelectorAll('button')[next]?.focus();
  }
  return (
    <div
      ref={group}
      role="group"
      aria-label={t('measuredAgainst')}
      className="inline-flex rounded-lg border p-0.5"
    >
      {periods.map((period, index) => (
        <Button
          key={`${period.year}-${period.period}`}
          variant="ghost"
          size="sm"
          aria-pressed={index === chosen}
          className={cn(
            'h-7 px-2.5 text-xs font-normal text-text-muted',
            index === chosen && 'bg-surface-raised font-medium text-text',
          )}
          onClick={() => choose(index)}
          onKeyDown={(event) => steer(event, index)}
        >
          {labels.period(period, frequency)}
        </Button>
      ))}
    </div>
  );
}
// KPIS-B04: the owner's own words on the newest reading that carries any. It is the one field on
// this page that says *why* a number moved, and it used to be an empty input in a table column.
export function LatestNote({ kpi }: { kpi: KpiDetail }) {
  const t = useTranslations('kpis');
  const date = usePlainDate();
  const latest = kpi.readings.find((reading) => reading.note.trim() !== '');
  if (!latest) return null;
  return (
    <figure className="m-0 grid gap-1 border-s-2 ps-3">
      <blockquote dir="auto" className="m-0 text-sm">
        {latest.note}
      </blockquote>
      <figcaption className="text-xs text-text-muted">
        {t('latestNote')} · <time dateTime={latest.readingDate}>{date(latest.readingDate)}</time>
      </figcaption>
    </figure>
  );
}
