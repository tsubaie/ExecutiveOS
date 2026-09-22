'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { Property } from '@/ui/layout/Property';
import { DatePicker } from '@/ui/layout/DatePicker';
import { useToday } from '@/ui/format';
import { EntityCreateForm } from '@/ui/entity/EntityCreateForm';
import type { CreateApi } from '@/ui/entity/types';
import { NoteCreate, type NoteDetail } from '../schema/validation';
import { useNoteTypes } from './queries';
import { CommitteePicker } from '@/modules/committees/ui';
import { TemplateSelect, TypeSelect } from './NoteSelects';
// Create asks for title, type, date and an optional template whose body becomes the content
// (notes.md § UI, NOTES-B27); everything else is added on the detail right after, with autosave.
export function CreateNote({
  api,
  committeeId = null,
}: {
  api: CreateApi<NoteCreate, NoteDetail>;
  committeeId?: string | null;
}) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const committees = useTranslations('committees');
  const today = useToday();
  const types = useNoteTypes();
  const [error, setError] = useState<Error | null>(null);
  const [type, setType] = useState('');
  const [noteDate, setNoteDate] = useState<string | null>(today);
  const [template, setTemplate] = useState({ id: '', body: '' });
  const fallback = types.data?.meta.defaultType ?? '';
  async function submit(form: FormData) {
    const fields = Object.fromEntries(form);
    try {
      await api.submit(
        NoteCreate.parse({
          title: fields.title,
          committeeId: fields.committeeId || null,
          type: type || fallback || null,
          noteDate: noteDate ?? today,
          content: template.body,
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    }
  }
  return (
    <EntityCreateForm
      title={t('newNote')}
      error={error}
      pending={api.pending}
      cancel={api.cancel}
      onSubmit={submit}
    >
      <Field label={t('title')}>
        {(control) => (
          <Input {...control} name="title" dir="auto" required pattern=".*\S.*" maxLength={500} />
        )}
      </Field>
      <Property label={committees('committee')}>
        <CommitteePicker value={committeeId} name="committeeId" />
      </Property>
      <CreateProperties
        type={type || fallback}
        setType={setType}
        noteDate={noteDate}
        setNoteDate={setNoteDate}
        template={template.id}
        setTemplate={setTemplate}
      />
    </EntityCreateForm>
  );
}
function CreateProperties({
  type,
  setType,
  noteDate,
  setNoteDate,
  template,
  setTemplate,
}: {
  type: string;
  setType: (type: string) => void;
  noteDate: string | null;
  setNoteDate: (date: string | null) => void;
  template: string;
  setTemplate: (template: { id: string; body: string }) => void;
}) {
  const t = useTranslations('notes');
  return (
    <div className="grid gap-2">
      <Property label={t('type')}>
        <TypeSelect value={type} onChange={setType} />
      </Property>
      <Property label={t('date')}>
        <DatePicker value={noteDate} onChange={setNoteDate} label={t('date')} />
      </Property>
      <Property label={t('template')}>
        <TemplateSelect
          value={template}
          label={t('template')}
          onPick={(id, body) => setTemplate({ id, body })}
        />
      </Property>
    </div>
  );
}
