'use client';
import { useTranslations } from 'next-intl';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
  ComboboxValue,
} from '@/ui/primitives/combobox';
import type { Choice, ChoiceSelectProps } from './choice';
// The searchable form of ChoiceSelect, loaded on demand so the combobox stays out of the initial
// route bundle. Plain string values keep Base UI's equality trivial; labels are looked up per
// render.
export default function SearchableChoice({
  items,
  value,
  onChange,
  label,
  name,
  size,
  disabled,
}: ChoiceSelectProps<string>) {
  const t = useTranslations('common');
  const byValue = new Map<string, Choice>(items.map((item) => [item.value, item]));
  const values = items.map((item) => item.value);
  return (
    <Combobox
      items={values}
      value={value}
      disabled={disabled}
      itemToStringLabel={(item: string) => byValue.get(item)?.text ?? ''}
      onValueChange={(next) => next !== null && next !== value && onChange(next)}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <ComboboxTrigger size={size ?? 'default'} aria-label={label}>
        <ComboboxValue>
          {(item: string | null) => (item === null ? null : byValue.get(item)?.label)}
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder={t('search')} aria-label={t('search')} />
        <ComboboxEmpty>{t('noMatches')}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {byValue.get(item)?.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
