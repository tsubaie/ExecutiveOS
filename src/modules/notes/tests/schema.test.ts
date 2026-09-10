import { it, expect } from 'vitest';
import { bandOf } from '@/core/time/notes';
import { NoteCreate, NotePatch, BulkItems, Tags } from '../schema/validation';
it('NOTES-I01 requires a trimmed title of at most 500 characters and bounded content', () => {
  expect(NoteCreate.safeParse({ title: '   ' }).success).toBe(false);
  expect(NoteCreate.safeParse({ title: 'x'.repeat(501) }).success).toBe(false);
  expect(NoteCreate.safeParse({ title: 'ok', content: 'x'.repeat(50001) }).success).toBe(false);
  expect(NoteCreate.parse({ title: '  Weekly  ' })).toMatchObject({
    title: 'Weekly',
    content: '',
    type: null,
    noteDate: null,
    tags: [],
    participantIds: [],
  });
  expect(NotePatch.safeParse({ title: 'x' }).success).toBe(false);
  expect(NotePatch.safeParse({ revision: 1, unknown: true }).success).toBe(false);
});
it('NOTES-I03 caps tags at ten and deduplicates case-insensitively keeping the first spelling', () => {
  expect(Tags.safeParse(Array.from({ length: 11 }, (_, i) => `t${i}`)).success).toBe(false);
  expect(Tags.safeParse(['x'.repeat(51)]).success).toBe(false);
  expect(Tags.parse(['Budget', 'budget', ' BUDGET ', 'Risk'])).toEqual(['Budget', 'Risk']);
});
it('NOTES-B12 bulk payloads need one to two hundred distinct items', () => {
  const item = { id: crypto.randomUUID(), revision: 1 };
  expect(BulkItems.safeParse({ items: [] }).success).toBe(false);
  expect(BulkItems.safeParse({ items: [item, item] }).success).toBe(false);
  expect(BulkItems.safeParse({ items: [item] }).success).toBe(true);
});
it('NOTES-B06 bands notes by distance from today', () => {
  expect(bandOf('2026-09-11', '2026-09-10')).toBe('upcoming');
  expect(bandOf('2026-09-10', '2026-09-10')).toBe('today');
  expect(bandOf('2026-09-04', '2026-09-10')).toBe('week');
  expect(bandOf('2026-09-03', '2026-09-10')).toBe('month');
  expect(bandOf('2026-08-11', '2026-09-10')).toBe('month');
  expect(bandOf('2026-08-10', '2026-09-10')).toBe('earlier');
});
