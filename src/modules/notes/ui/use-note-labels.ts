'use client';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { addDays } from '@/core/time/notes';
import { plainDateValue as atUtc, usePlainDate, useToday } from '@/ui/format';
import { DefaultType, type Note, type NoteType } from '../schema/validation';
export type DateLabel = { label: string; absolute: string; tone: 'accent' | 'muted' };
// Rows show a relative date within six days either way and the date beyond that (notes.md § UI).
// The band comes from the server (NOTES-B06); only the wording is decided here.
export function useNoteDateLabel() {
  const t = useTranslations('notes');
  const format = useFormatter();
  const plainDate = usePlainDate();
  const today = useToday();
  const weekday = (day: string) =>
    format.dateTime(atUtc(day), { weekday: 'long', timeZone: 'UTC' });
  return (note: Pick<Note, 'noteDate' | 'band'>): DateLabel => {
    const absolute = plainDate(note.noteDate);
    if (note.band === 'today') return { label: t('today'), absolute, tone: 'accent' };
    if (note.noteDate === addDays(today, 1))
      return { label: t('tomorrow'), absolute, tone: 'muted' };
    if (note.noteDate === addDays(today, -1))
      return { label: t('yesterday'), absolute, tone: 'muted' };
    const near = note.noteDate > addDays(today, -7) && note.noteDate < addDays(today, 7);
    return { label: near ? weekday(note.noteDate) : absolute, absolute, tone: 'muted' };
  };
}
// Configured labels win; the six defaults have catalog entries; anything else shows its id.
export function useTypeLabel(types: NoteType[] | undefined) {
  const t = useTranslations('notes');
  const locale = useLocale();
  return (typeId: string) => {
    const configured = types?.find((type) => type.id === typeId)?.labels?.[locale];
    if (configured) return configured;
    const known = DefaultType.safeParse(typeId);
    return known.success ? t(known.data) : typeId;
  };
}
