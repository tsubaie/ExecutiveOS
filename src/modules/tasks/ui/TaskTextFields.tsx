'use client';
import { Suspense, lazy, type FocusEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Field } from '@/ui/layout/Field';
// The markdown field loads on demand so the Tasks route stays under its bundle budget.
const MarkdownField = lazy(() =>
  import('@/ui/markdown/MarkdownField').then((m) => ({ default: m.MarkdownField })),
);
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
    initial,
    blur: (field: keyof TextValues, value: string) => {
      const parsed = schema.shape[field].safeParse(value);
      if (!parsed.success || parsed.data === (initial?.[field] ?? '')) return;
      save?.(field === 'title' ? { title: parsed.data } : { description: parsed.data || null });
    },
  };
}
// In the detail panel the title is the heading itself: one editable field instead of a heading
// plus a labelled input (tasks.md § UI). Enter commits; the accessible label stays "Task title".
export function TaskTitle({
  editor,
  heading = false,
}: {
  editor: ReturnType<typeof useTaskText>;
  heading?: boolean;
}) {
  const t = useTranslations('tasks');
  const field = editor.form.register('title');
  const error = editor.form.formState.errors.title?.message;
  const blur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    void field.onBlur(event);
    editor.blur('title', event.target.value);
  };
  if (heading)
    return (
      <div className="grid gap-1">
        <h2 tabIndex={-1} className="min-w-0 rounded-md">
          <Textarea
            {...field}
            dir="auto"
            required
            rows={1}
            maxLength={500}
            aria-label={t('title')}
            aria-invalid={Boolean(error)}
            className="plaintext min-h-0 resize-none rounded-md border-transparent px-2 py-1 text-xl leading-snug font-semibold hover:border-border md:text-xl"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            onBlur={blur}
          />
        </h2>
        {error && (
          <span role="alert" className="px-2 text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    );
  return (
    <Field label={t('title')} error={error}>
      {(control) => (
        <Input
          {...field}
          {...control}
          dir="auto"
          required
          pattern=".*\S.*"
          maxLength={500}
          onBlur={blur}
        />
      )}
    </Field>
  );
}
// Markdown with a preview (ADR 0015); `name` keeps the value in the create form's post.
export function TaskDescription({ editor }: { editor: ReturnType<typeof useTaskText> }) {
  const t = useTranslations('tasks');
  return (
    <Suspense fallback={<div className="min-h-40 rounded-lg border" aria-busy />}>
      <MarkdownField
        name="description"
        label={t('description')}
        value={editor.initial?.description ?? ''}
        onCommit={(value) => editor.blur('description', value)}
      />
    </Suspense>
  );
}
