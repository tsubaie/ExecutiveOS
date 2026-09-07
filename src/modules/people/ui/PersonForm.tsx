'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { PersonFields, Kind } from '../schema/validation';
import { Field } from '@/ui/layout/Field';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Button } from '@/ui/primitives/button';
export type Values = z.infer<typeof PersonFields>;
export type Patch = Partial<Values>;
export const emptyPerson: Values = {
  fullName: '',
  displayName: null,
  honorific: null,
  organization: null,
  roleTitle: null,
  kind: 'external',
  email: null,
  phone: null,
  notes: null,
  tags: [],
  isAssignable: false,
  userId: null,
};
export function PersonForm({
  initial = emptyPerson,
  submit,
  save,
  pending = false,
}: {
  initial?: Values;
  submit?: (values: Values) => void;
  save?: (patch: Patch) => void;
  pending?: boolean;
}) {
  const t = useTranslations('people');
  const c = useTranslations('common');
  const form = useForm({ resolver: zodResolver(PersonFields), defaultValues: initial });
  const assignable = useWatch({ control: form.control, name: 'isAssignable' });
  const textFields = z.enum([
    'fullName',
    'displayName',
    'honorific',
    'organization',
    'roleTitle',
    'email',
    'phone',
  ]);
  return (
    <form className="grid gap-5" onSubmit={form.handleSubmit((values) => submit?.(values))}>
      {textFields.options.map((key) => (
        <Field key={key} label={t(key)} error={form.formState.errors[key]?.message}>
          <Input
            dir="auto"
            type={key === 'email' ? 'email' : 'text'}
            required={key === 'fullName'}
            {...form.register(key)}
            onBlur={async (event) => {
              await form.register(key).onBlur(event);
              if (await form.trigger(key)) save?.({ [key]: form.getValues(key) });
            }}
          />
        </Field>
      ))}
      <Field label={t('kind')}>
        <NativeSelect
          {...form.register('kind')}
          onChange={(event) => {
            const kind = Kind.parse(event.target.value);
            form.setValue('kind', kind);
            save?.({ kind });
          }}
        >
          {Kind.options.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {c(kind)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox
          checked={assignable}
          onCheckedChange={(checked) => {
            form.setValue('isAssignable', checked);
            save?.({ isAssignable: checked });
          }}
        />
        {t('isAssignable')}
      </label>
      <Field label={t('tags')}>
        <Input
          dir="auto"
          defaultValue={initial.tags.join(', ')}
          onBlur={(event) => {
            const tags = event.target.value
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            form.setValue('tags', tags);
            if (PersonFields.shape.tags.safeParse(tags).success) save?.({ tags });
          }}
        />
      </Field>
      <Field label={t('notes')} error={form.formState.errors.notes?.message}>
        <Textarea
          dir="auto"
          rows={5}
          {...form.register('notes')}
          onBlur={async (event) => {
            await form.register('notes').onBlur(event);
            if (await form.trigger('notes')) save?.({ notes: form.getValues('notes') });
          }}
        />
      </Field>
      {submit && (
        <Button type="submit" disabled={pending}>
          {pending ? c('saving') : c('create')}
        </Button>
      )}
    </form>
  );
}
