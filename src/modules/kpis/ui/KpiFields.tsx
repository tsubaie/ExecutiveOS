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
const rows = (save: Save | undefined) => (save ? 'grid gap-2' : 'grid gap-4');
// EP-B25: in a record the properties read as facts and become controls on contact; in the create
// form every one of them should look ready, which is what `save` being absent means here.
//
// The two groups are separated by who reads them. Ownership — who holds the measure and what it
// belongs to — is state a principal scans. The definition is how the measure is written down: set
// once by its owner, read by nobody afterwards, and folded away at the end of the record.
export function KpiOwnership({ initial, save }: Part) {
  return (
    <fieldset data-autosave={save ? true : undefined} className={rows(save)}>
      <Owner initial={initial} save={save} />
      <Objective initial={initial} save={save} />
    </fieldset>
  );
}
export function KpiDefinition({
  initial,
  save,
  nameError,
}: Part & { nameError?: string | undefined }) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  return (
    <fieldset data-autosave={save ? true : undefined} className={rows(save)}>
      <Field label={t('name')} error={nameError} quiet={quiet} row={quiet}>
        {(control) => (
          <Input
            {...control}
            name="name"
            dir="auto"
            required
            autoComplete="off"
            maxLength={500}
            defaultValue={initial.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== initial.name) save?.({ name });
            }}
          />
        )}
      </Field>
      <Property label={t('direction')} quiet={quiet}>
        <DirectionToggle value={initial.direction} save={save} />
      </Property>
      <Measurement initial={initial} save={save} />
      <Field label={t('notes')} quiet={quiet} empty={!initial.notes}>
        {(control) => (
          <Textarea
            {...control}
            name="notes"
            dir="auto"
            rows={3}
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
// The create form is the same fields with nothing quiet: there is no record to read yet, so every
// control should look ready to fill in.
export function KpiFields({
  initial,
  nameError,
}: {
  initial: KpiCreate;
  nameError?: string | undefined;
}) {
  return (
    <div className="grid gap-4">
      <KpiDefinition initial={initial} nameError={nameError} />
      <KpiOwnership initial={initial} />
    </div>
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
function Objective({ initial, save }: Part) {
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
      <Category initial={initial} save={save} />
    </>
  );
}
// Where the measure is filed. Free text, because a workspace's own filing is not ours to enumerate.
function Category({ initial, save }: Part) {
  const t = useTranslations('kpis');
  const quiet = Boolean(save);
  return (
    <Field label={t('category')} quiet={quiet} row={quiet} empty={!initial.category}>
      {(control) => (
        <Input
          {...control}
          name="category"
          dir="auto"
          autoComplete="off"
          maxLength={100}
          defaultValue={initial.category}
          onBlur={(event) => {
            const category = event.target.value.trim();
            if (category !== initial.category) save?.({ category });
          }}
        />
      )}
    </Field>
  );
}
