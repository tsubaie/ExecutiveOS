'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Field } from '@/ui/layout/Field';
import { Property } from '@/ui/layout/Property';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { Direction, type KpiCreate, type KpiPatch } from '../schema/validation';
import { useObjectives } from './queries';
export const NO_OBJECTIVE = 'none';
export const splitTeams = (raw: string) =>
  raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 10);
type Save = (patch: Omit<KpiPatch, 'revision'>) => void;
type Part = { initial: KpiCreate; save?: Save | undefined };
// EP-B25: in a record the properties read as facts and become controls on contact; in the create
// form every one of them should look ready, which is what `save` being absent means here.
export function KpiFields({ initial, save, nameError }: Part & { nameError?: string | undefined }) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  return (
    <fieldset data-autosave={save ? true : undefined} className="grid gap-4">
      <Field label={t('name')} error={nameError} quiet={quiet}>
        {(control) => (
          <Input
            {...control}
            name="name"
            dir="auto"
            required
            maxLength={500}
            defaultValue={initial.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== initial.name) save?.({ name });
            }}
          />
        )}
      </Field>
      <Placement initial={initial} save={save} />
      <Measurement initial={initial} save={save} />
      <Field label={t('notes')} quiet={quiet} empty={!initial.notes}>
        {(control) => (
          <Textarea
            {...control}
            name="notes"
            dir="auto"
            rows={4}
            maxLength={50000}
            defaultValue={initial.notes}
            onBlur={(event) => {
              if (event.target.value !== initial.notes) save?.({ notes: event.target.value });
            }}
          />
        )}
      </Field>
    </fieldset>
  );
}
// The two choices that decide how the KPI is read: which way is good, and what it belongs to.
function Placement({ initial, save }: Part) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  const objectives = useObjectives();
  const incoming = { direction: initial.direction, objective: initial.objectiveId ?? NO_OBJECTIVE };
  const [choice, setChoice] = useState(incoming);
  const [seen, setSeen] = useState(incoming);
  if (seen.direction !== incoming.direction || seen.objective !== incoming.objective) {
    setSeen(incoming);
    setChoice(incoming);
  }
  return (
    <>
      <Property label={t('direction')} quiet={quiet}>
        <ChoiceSelect
          label={t('direction')}
          name="direction"
          value={choice.direction}
          items={Direction.options.map((value) => ({ value, text: t(value), label: t(value) }))}
          onChange={(direction) => {
            setChoice((value) => ({ ...value, direction }));
            save?.({ direction });
          }}
        />
      </Property>
      <Property label={t('objective')} quiet={quiet} empty={choice.objective === NO_OBJECTIVE}>
        <ChoiceSelect
          label={t('objective')}
          name="objectiveId"
          value={choice.objective}
          items={[
            { value: NO_OBJECTIVE, text: t('noObjective'), label: t('noObjective') },
            ...(objectives.data?.data ?? []).map((row) => ({
              value: row.id,
              text: row.name,
              label: row.name,
            })),
          ]}
          onChange={(objective) => {
            setChoice((value) => ({ ...value, objective }));
            save?.({ objectiveId: objective === NO_OBJECTIVE ? null : objective });
          }}
        />
      </Property>
    </>
  );
}
// How the measure is written down: its unit, where it is filed, who owns it, and how long a
// reading stays current before the scorecard stops trusting it.
function Measurement({ initial, save }: Part) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  return (
    <>
      <Written
        label={t('unit')}
        name="unit"
        value={initial.unit}
        limit={50}
        quiet={quiet}
        save={(unit) => save?.({ unit })}
      />
      <Written
        label={t('category')}
        name="category"
        value={initial.category}
        limit={100}
        quiet={quiet}
        save={(category) => save?.({ category })}
      />
      <Field label={t('teams')} hint={t('teamsHint')} quiet={quiet} empty={!initial.teams.length}>
        {(control) => (
          <Input
            {...control}
            name="teams"
            dir="auto"
            defaultValue={initial.teams.join(', ')}
            onBlur={(event) => {
              const teams = splitTeams(event.target.value);
              if (teams.join(' ') !== initial.teams.join(' ')) save?.({ teams });
            }}
          />
        )}
      </Field>
      <Field label={t('freshness')} hint={t('freshnessHint')} quiet={quiet}>
        {(control) => (
          <Input
            {...control}
            name="freshnessDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={initial.freshnessDays}
            onBlur={(event) => {
              const days = Number(event.target.value);
              if (Number.isInteger(days) && days > 0 && days !== initial.freshnessDays)
                save?.({ freshnessDays: days });
            }}
          />
        )}
      </Field>
    </>
  );
}
// A trimmed single-line value that writes itself back only when it actually changed.
function Written({
  label,
  name,
  value,
  limit,
  quiet,
  save,
}: {
  label: string;
  name: string;
  value: string;
  limit: number;
  quiet: boolean;
  save: (next: string) => void;
}) {
  return (
    <Field label={label} quiet={quiet} empty={!value}>
      {(control) => (
        <Input
          {...control}
          name={name}
          dir="auto"
          maxLength={limit}
          defaultValue={value}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next !== value) save(next);
          }}
        />
      )}
    </Field>
  );
}
