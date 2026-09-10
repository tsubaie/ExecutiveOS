'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { Property } from '@/ui/layout/Property';
import { DatePicker } from '@/ui/layout/DatePicker';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useToday } from '@/ui/format';
import type { CreateApi } from '@/ui/entity/types';
import { NoteCreate, type NoteDetail } from '../schema/validation';
import { useNoteTypes } from './queries';
import { TypeSelect } from './NoteFields';
// Create asks for title, type and date only (notes.md § UI); everything else is added on the
// detail right after, with autosave.
export function CreateNote({ api }: { api: CreateApi<NoteCreate, NoteDetail> }) {
  const t = useTranslations('notes');
  const c = useTranslations('common');
  const today = useToday();
  const types = useNoteTypes();
  const [error, setError] = useState<Error | null>(null);
  const [type, setType] = useState('');
  const [noteDate, setNoteDate] = useState<string | null>(today);
  const fallback = types.data?.meta.defaultType ?? '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.submit(
        NoteCreate.parse({
          title: fields.title,
          type: type || fallback || null,
          noteDate: noteDate ?? today,
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    }
  }
  return (
    <form className="grid gap-5 p-5" onSubmit={(event) => void submit(event)}>
      <h2 tabIndex={-1} className="text-xl font-semibold">
        {t('newNote')}
      </h2>
      {error && <ErrorPanel error={error} />}
      <Field label={t('title')}>
        {(control) => (
          <Input {...control} name="title" dir="auto" required pattern=".*\S.*" maxLength={500} />
        )}
      </Field>
      <div className="grid gap-2">
        <Property label={t('type')}>
          <TypeSelect value={type || fallback} onChange={setType} />
        </Property>
        <Property label={t('date')}>
          <DatePicker value={noteDate} onChange={setNoteDate} label={t('date')} />
        </Property>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={api.pending}>
          {c('create')}
        </Button>
        <Button variant="outline" onClick={api.cancel}>
          {c('cancel')}
        </Button>
      </div>
    </form>
  );
}
