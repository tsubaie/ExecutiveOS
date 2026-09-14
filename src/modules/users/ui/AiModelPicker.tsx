'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { AiModel } from '@/core/config/ai-model-schema';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { Field } from '@/ui/layout/Field';
import { Input } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
export function AiModelPicker({ models, value, setValue, label }: {
  models: z.infer<typeof AiModel>[]; value: string; setValue: (value: string) => void; label: string;
}) {
  const t = useTranslations('admin');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const providers = [...new Set(models.map((model) => model.id.split('/')[0] ?? ''))].sort();
  const words = search.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const matches = models.filter((model) => (!provider || model.id.startsWith(`${provider}/`)) &&
    words.every((word) => `${model.id} ${model.name}`.toLowerCase().includes(word)));
  const selected = models.find((model) => model.id === value);
  const shown = selected && !matches.some((model) => model.id === value) ? [selected, ...matches] : matches;
  const modelChoices = shown.map((model) => ({ value: model.id, label: `${model.name} · ${model.id}`, text: `${model.name} ${model.id}` }));
  if (!selected) modelChoices.unshift({ value, label: value ? t('aiSelectionUnavailable', { model: value }) : t('aiChooseModel'), text: value });
  const providerChoices = [{ value: '', label: t('aiAllProviders'), text: t('aiAllProviders') }, ...providers.map((name) => ({ value: name, label: name, text: name }))];
  return <fieldset className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">{label}</legend>
    <Field label={t('aiSearchModels')}>{(control) => <Input {...control} type="search" value={search}
      placeholder={t('aiSearchModelsPlaceholder')} onChange={(event) => setSearch(event.target.value)} />}</Field>
    <div className="grid gap-2"><span className="text-sm font-medium">{t('aiModelProvider')}</span>
      <ChoiceSelect label={t('aiModelProvider')} items={providerChoices} value={provider} onChange={setProvider} />
    </div>
    <p role="status" className="text-xs text-text-muted">{t('aiMatchingModels', { count: matches.length, total: models.length })}</p>
    <div className="grid gap-2"><span className="text-sm font-medium">{label}</span>
      <ChoiceSelect label={label} items={modelChoices} value={value} onChange={(next) => { if (models.some((model) => model.id === next)) setValue(next); }} />
    </div>
    {!selected && value && <p role="alert" className="text-sm text-danger">{t('aiReplaceUnavailable')}</p>}
    {!matches.length && <p className="text-sm text-text-muted">{t('aiNoMatchingModels')}</p>}
    {(search || provider) && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setProvider(''); }}>{t('aiClearModelFilters')}</Button>}
  </fieldset>;
}
