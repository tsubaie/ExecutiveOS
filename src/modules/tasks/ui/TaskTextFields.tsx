'use client';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Field } from '@/ui/layout/Field';
import type { TaskPatch } from '../schema/validation';
type TextValues = { title: string; description: string };
export function useTaskText(
  initial: Partial<TextValues> | undefined,
  save?: (patch: Omit<TaskPatch, 'revision'>) => void,
) {
  const c = useTranslations('common');
  const schema = z.object({
    title: z.string().trim().min(1, c('titleRequired')).max(500),
    description: z.string().max(50000),
  });
  const form = useForm<TextValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { title: initial?.title ?? '', description: initial?.description ?? '' },
  });
  return {
    form,
    blur: (field: keyof TextValues, value: string) => {
      const parsed = schema.shape[field].safeParse(value);
      if (!parsed.success || parsed.data === (initial?.[field] ?? '')) return;
      save?.(field === 'title' ? { title: parsed.data } : { description: parsed.data || null });
    },
  };
}
export function TaskTitle({ editor }: { editor: ReturnType<typeof useTaskText> }) {
  const t = useTranslations('tasks');
  const field = editor.form.register('title');
  return (
    <Field label={t('title')} error={editor.form.formState.errors.title?.message}>
      <Input
        {...field}
        dir="auto"
        required
        pattern=".*\S.*"
        maxLength={500}
        aria-invalid={Boolean(editor.form.formState.errors.title)}
        onBlur={(event) => {
          void field.onBlur(event);
          editor.blur('title', event.target.value);
        }}
      />
    </Field>
  );
}
export function TaskDescription({ editor }: { editor: ReturnType<typeof useTaskText> }) {
  const t = useTranslations('tasks');
  const field = editor.form.register('description');
  return (
    <Field label={t('description')} error={editor.form.formState.errors.description?.message}>
      <Textarea
        {...field}
        dir="auto"
        className="min-h-24"
        maxLength={50000}
        onBlur={(event) => {
          void field.onBlur(event);
          editor.blur('description', event.target.value);
        }}
      />
    </Field>
  );
}
