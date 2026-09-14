'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Field } from '@/ui/layout/Field';
import { Property } from '@/ui/layout/Property';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { Frequency, Unit, type KpiCreate, type KpiPatch } from '../schema/validation';
import { useKpiLabels } from './use-kpi-labels';
import { DirectionToggle, UnitOption } from './KpiPickers';
import { useKpiFacets, useObjectives } from './queries';
export const NO_OBJECTIVE = 'none';
export const NO_OWNER = 'none';
type Save = (patch: Omit<KpiPatch, 'revision'>) => void;
type Part = { initial: KpiCreate; save?: Save | undefined };
// EP-B25: in a record the properties read as facts and become controls on contact; in the create
// form every one of them should look ready, which is what `save` being absent means here.
export function KpiFields({ initial, save, nameError }: Part & { nameError?: string | undefined }) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  return (
    <fieldset
      data-autosave={save ? true : undefined}
      className={quiet ? 'grid gap-2' : 'grid gap-4'}
    >
      <Field label={t('name')} error={nameError} quiet={quiet} row={quiet}>
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
      <Owner initial={initial} save={save} />
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
  const incoming = initial.objectiveId ?? NO_OBJECTIVE;
  const [objective, setObjective] = useState(incoming);
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    setObjective(incoming);
  }
  return (
    <>
      <Property label={t('direction')} quiet={quiet}>
        <DirectionToggle value={initial.direction} save={save} />
      </Property>
      <Property label={t('objective')} quiet={quiet} empty={objective === NO_OBJECTIVE}>
        <ChoiceSelect
          label={t('objective')}
          name="objectiveId"
          value={objective}
          items={[
            { value: NO_OBJECTIVE, text: t('noObjective'), label: t('noObjective') },
            ...(objectives.data?.data ?? []).map((row) => ({
              value: row.id,
              text: row.name,
              label: row.name,
            })),
          ]}
          onChange={(next) => {
            setObjective(next);
            save?.({ objectiveId: next === NO_OBJECTIVE ? null : next });
          }}
        />
      </Property>
    </>
  );
}
// How the measure is written down: the symbol its values carry, the cadence it is reported on, and
// where it is filed.
function Measurement({ initial, save }: Part) {
  const t = useTranslations('kpis');
  const labels = useKpiLabels();
  const quiet = Boolean(save);
  const incoming = { unit: initial.unit, frequency: initial.frequency };
  const [draft, setDraft] = useState(incoming);
  const [seen, setSeen] = useState(incoming);
  if (seen.unit !== incoming.unit || seen.frequency !== incoming.frequency) {
    setSeen(incoming);
    setDraft(incoming);
  }
  return (
    <>
      <Property label={t('unit')} quiet={quiet}>
        <ChoiceSelect
          label={t('unit')}
          name="unit"
          value={draft.unit}
          items={Unit.options.map((unit) => ({
            value: unit,
            text: labels.unit(unit),
            label: <UnitOption unit={unit} />,
          }))}
          onChange={(unit) => {
            setDraft((value) => ({ ...value, unit }));
            save?.({ unit });
          }}
        />
      </Property>
      <Property label={t('frequency')} quiet={quiet}>
        <ChoiceSelect
          label={t('frequency')}
          name="frequency"
          value={draft.frequency}
          items={Frequency.options.map((frequency) => ({
            value: frequency,
            text: t(frequency),
            label: t(frequency),
          }))}
          onChange={(frequency) => {
            setDraft((value) => ({ ...value, frequency }));
            save?.({ frequency });
          }}
        />
      </Property>
      <Written
        label={t('category')}
        name="category"
        value={initial.category}
        limit={100}
        quiet={quiet}
        save={(category) => save?.({ category })}
      />
    </>
  );
}
// Who holds the measure. People are the only owner identity in this product (ADR 0011), so the
// choices are the assignable part of the directory rather than a free-text team name.
function Owner({ initial, save }: Part) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  const facets = useKpiFacets();
  const incoming = initial.ownerId ?? NO_OWNER;
  const [owner, setOwner] = useState(incoming);
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    setOwner(incoming);
  }
  return (
    <Property label={t('owner')} quiet={quiet} empty={owner === NO_OWNER}>
      <ChoiceSelect
        label={t('owner')}
        name="ownerId"
        value={owner}
        items={[
          { value: NO_OWNER, text: t('noOwner'), label: t('noOwner') },
          ...(facets.data?.owners ?? []).map((row) => ({
            value: row.id,
            text: row.name,
            label: row.name,
          })),
        ]}
        onChange={(next) => {
          setOwner(next);
          save?.({ ownerId: next === NO_OWNER ? null : next });
        }}
      />
    </Property>
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
    <Field label={label} quiet={quiet} row={quiet} empty={!value}>
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
