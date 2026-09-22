'use client';
import { useLocale, useTranslations } from 'next-intl';
import { ChoiceSelect, type Choice } from '@/ui/layout/ChoiceSelect';
import { templateBody, type NoteTemplate } from '../schema/validation';
import { useNoteTemplates, useNoteTypes } from './queries';
import { useTypeLabel } from './use-note-labels';
// "No type" first, then the enabled types, plus the note's current type when it has since been
// disabled (NOTES-I02).
export function TypeSelect({
  value,
  current,
  onChange,
  name,
}: {
  value: string;
  current?: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  const t = useTranslations('notes');
  const types = useNoteTypes();
  const label = useTypeLabel(types.data?.data);
  const ids = (types.data?.data ?? []).filter((type) => type.enabled).map((type) => type.id);
  if (current && !ids.includes(current)) ids.unshift(current);
  if (value && !ids.includes(value)) ids.unshift(value);
  const items: Choice[] = [
    { value: '', text: t('noType'), label: t('noType') },
    ...ids.map((id) => ({ value: id, text: label(id), label: label(id) })),
  ];
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={t('type')}
      disabled={types.isPending || Boolean(types.error)}
      {...(name ? { name } : {})}
      onChange={onChange}
    />
  );
}
// NOTES-B27: what a pick hands back: the template's body for the locale, or an empty string
// for "No template" or an unknown identifier.
export function pickTemplate(list: NoteTemplate[], id: string, locale: string) {
  const template = list.find((item) => item.id === id);
  return template ? templateBody(template, locale) : '';
}
// The enabled templates, labelled for the reader's locale; `onPick` receives the identifier and
// its body (pickTemplate). Renders nothing when there is no template to offer.
export function TemplateSelect({
  value,
  label,
  onPick,
}: {
  value: string;
  label: string;
  onPick: (id: string, body: string) => void;
}) {
  const t = useTranslations('notes');
  const locale = useLocale();
  const templates = useNoteTemplates();
  const list = templates.data?.data ?? [];
  if (!list.length) return null;
  const items: Choice[] = [
    { value: '', text: t('noTemplate'), label: t('noTemplate') },
    ...list.map((template) => {
      const text = template.labels[locale] ?? template.labels.en ?? template.id;
      return { value: template.id, text, label: text };
    }),
  ];
  return (
    <ChoiceSelect
      items={items}
      value={value}
      label={label}
      onChange={(id) => onPick(id, pickTemplate(list, id, locale))}
    />
  );
}
