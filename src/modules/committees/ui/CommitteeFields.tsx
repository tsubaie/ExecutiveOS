'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Field } from '@/ui/layout/Field';
import { Property } from '@/ui/layout/Property';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { Scope, Status, type CommitteeCreate, type CommitteePatch } from '../schema/validation';
export function CommitteeFields({ initial, save, nameError }: { initial: CommitteeCreate; save?: (patch: Omit<CommitteePatch, 'revision'>) => void; nameError?: string | undefined }) {
  const t = useTranslations('committees');
  const [properties, setProperties] = useState({ scope: initial.scope, status: initial.status });
  const [seen, setSeen] = useState(properties);
  if (seen.scope !== initial.scope || seen.status !== initial.status) {
    const next = { scope: initial.scope, status: initial.status }; setSeen(next); setProperties(next);
  }
  return <fieldset data-autosave={save ? true : undefined} className="grid gap-4">
    <Field label={t('name')} error={nameError}>{(control) => <Input {...control} name="name" dir="auto" required pattern=".*\S.*" maxLength={500}
      defaultValue={initial.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== initial.name) save?.({ name }); }} />}</Field>
    <Property label={t('scope')}><ChoiceSelect label={t('scope')} name="scope" value={properties.scope}
      items={Scope.options.map((scope) => ({ value: scope, text: t(scope), label: t(scope) }))}
      onChange={(scope) => { setProperties((value) => ({ ...value, scope })); save?.({ scope }); }} /></Property>
    <Property label={t('status')}><ChoiceSelect label={t('status')} name="status" value={properties.status}
      items={Status.options.map((status) => ({ value: status, text: t(status), label: t(status) }))}
      onChange={(status) => { setProperties((value) => ({ ...value, status })); save?.({ status }); }} /></Property>
    <Field label={t('ownership')}>{(control) => <Input {...control} name="ownership" dir="auto" maxLength={500} defaultValue={initial.ownership}
      onBlur={(event) => { if (event.target.value.trim() !== initial.ownership) save?.({ ownership: event.target.value.trim() }); }} />}</Field>
    <Field label={t('description')}>{(control) => <Textarea {...control} name="description" dir="auto" rows={4} maxLength={50000} defaultValue={initial.description}
      onBlur={(event) => { if (event.target.value !== initial.description) save?.({ description: event.target.value }); }} />}</Field>
  </fieldset>;
}
