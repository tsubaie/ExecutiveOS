import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { getSetting, writeSetting } from '@/core/db/settings-repo';
import { dayAt, addDays } from '@/core/time/notes';
import { removePerson } from '@/modules/people';
import { completeTask, getTask, patchTask } from '@/modules/tasks/service';
import { TaskPatch } from '@/modules/tasks/schema/validation';
import { tasks } from '@/modules/tasks/schema/db';
import { notes, notePeople } from '../schema/db';
import { NotePatch, NoteListQuery, BulkItems, BulkTag } from '../schema/validation';
import * as service from '../service';
import { harness, actorId } from './fixtures';
const { run, note, person, task } = harness;
const list = (query: Record<string, string> = {}) =>
  run((ctx) => service.listNotes(ctx, NoteListQuery.parse(query)));
const patch = (noteId: string, fields: Record<string, unknown>) =>
  run((ctx) => service.patchNote(ctx, noteId, NotePatch.parse(fields)));
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(() => harness.reset());
afterAll(() => pool().end());
it('NOTES-B01 NOTES-A01 creates a note with no type, today in the workspace timezone, no participants and no tasks', async () => {
  const created = await note('Board pre-read');
  const timezone = await getSetting(db(), 'workspace.timezone');
  expect(created.type).toBeNull();
  expect(created.noteDate).toBe(dayAt(timezone));
  expect(created.participants).toEqual([]);
  expect(created.tasks).toEqual([]);
  expect(created.content).toBe('');
  expect(created.archivedAt).toBeNull();
  const listed = await list();
  expect(listed.data.map((row) => row.id)).toEqual([created.id]);
  expect(listed.data[0]?.band).toBe('today');
  expect(listed.meta.types.map((type) => type.id)).toContain('one_on_one');
  await writeSetting(db(), 'notes.default_type', 'personal', actorId());
  expect((await note('Diary')).type).toBe('personal');
  expect((await patch(created.id, { revision: 1, type: null })).type).toBeNull();
});
it('NOTES-I02 refuses a disabled type on create and on change while existing notes keep it', async () => {
  const configured = [
    { id: 'personal', labels: { en: 'Personal', ar: 'شخصي' }, enabled: true },
    { id: 'other', labels: { en: 'Other', ar: 'أخرى' }, enabled: false },
  ];
  await writeSetting(db(), 'notes.types', configured, actorId());
  await writeSetting(db(), 'notes.default_type', 'personal', actorId());
  await expect(note('Misc', { type: 'other' })).rejects.toMatchObject({
    code: 'rule_violation',
    details: { rule: 'NOTES-I02' },
  });
  const created = await note('Journal');
  expect(created.type).toBe('personal');
  await writeSetting(
    db(),
    'notes.types',
    configured.map((type) => ({ ...type, enabled: type.id === 'other' })),
    actorId(),
  );
  const renamed = await patch(created.id, { revision: 1, title: 'Journal, day two' });
  expect(renamed.type).toBe('personal');
  await expect(patch(created.id, { revision: 2, type: 'personal' })).rejects.toMatchObject({
    details: { rule: 'NOTES-I02' },
  });
  expect((await list()).meta.counts['type:other']).toBe(0);
  expect((await list()).meta.counts['type:personal']).toBeUndefined();
});
it('NOTES-I04 NOTES-B07 NOTES-B08 participants deduplicate, replace as a set, and hide deleted people', async () => {
  const [a, b, c] = await Promise.all([
    person('Leila Haddad'),
    person('Omar Nasser'),
    person('Maya Faris'),
  ]);
  if (!a || !b || !c) throw new Error('people missing');
  const created = await note('Steering', { participantIds: [a.id, a.id, b.id] });
  expect(created.participants.map((row) => row.name)).toEqual(['Leila Haddad', 'Omar Nasser']);
  const replaced = await patch(created.id, { revision: 1, participantIds: [b.id, c.id] });
  expect(replaced.participants.map((row) => row.id)).toEqual([b.id, c.id]);
  expect(replaced.revision).toBe(2);
  const rows = await db().select().from(notePeople).where(eq(notePeople.noteId, created.id));
  expect(rows.filter((row) => row.deletedAt).map((row) => row.personId)).toEqual([a.id]);
  await run((ctx) => removePerson(ctx, c.id, c.revision));
  expect((await run((ctx) => service.getNote(ctx, created.id))).participants).toHaveLength(1);
  await expect(
    db().insert(notePeople).values({ id: b.id, noteId: created.id, personId: b.id }),
  ).rejects.toThrow();
  await expect(patch(created.id, { revision: 2, participantIds: [c.id] })).rejects.toMatchObject({
    code: 'not_found',
  });
});
it('NOTES-I05 TASKS-B16 NOTES-B09 attaches only open, top-level, unlinked tasks and detaches by null', async () => {
  const first = await note('Kickoff');
  const second = await note('Follow-up');
  const born = await task('Draft charter', { sourceNoteId: first.id });
  expect(born.sourceNote?.id).toBe(first.id);
  const existing = await task('Book venue');
  const attached = await run((ctx) =>
    patchTask(ctx, existing.id, TaskPatch.parse({ revision: 1, sourceNoteId: first.id })),
  );
  expect(attached.sourceNote?.title).toBe('Kickoff');
  const child = await task('Child', { parentId: existing.id });
  await expect(
    run((ctx) =>
      patchTask(ctx, child.id, TaskPatch.parse({ revision: 1, sourceNoteId: first.id })),
    ),
  ).rejects.toMatchObject({ details: { rule: 'TASKS-B16' } });
  await expect(
    run((ctx) =>
      patchTask(ctx, existing.id, TaskPatch.parse({ revision: 2, sourceNoteId: second.id })),
    ),
  ).rejects.toMatchObject({ details: { rule: 'TASKS-B16' } });
  const done = await run((ctx) => completeTask(ctx, born.id, 1));
  await expect(
    run((ctx) =>
      patchTask(ctx, done.id, TaskPatch.parse({ revision: 2, sourceNoteId: second.id })),
    ),
  ).rejects.toMatchObject({ details: { rule: 'TASKS-B16' } });
  const detail = await run((ctx) => service.getNote(ctx, first.id));
  expect(detail.tasks.map((row) => [row.title, row.status])).toEqual([
    ['Book venue', 'inbox'],
    ['Draft charter', 'completed'],
  ]);
  expect((await list()).data.find((row) => row.id === first.id)).toMatchObject({
    openTaskCount: 1,
    doneTaskCount: 1,
  });
  const detached = await run((ctx) =>
    patchTask(ctx, existing.id, TaskPatch.parse({ revision: 2, sourceNoteId: null })),
  );
  expect(detached.sourceNote).toBeNull();
  await expect(task('Orphan', { sourceNoteId: crypto.randomUUID() })).rejects.toMatchObject({
    code: 'not_found',
  });
});
it('NOTES-I06 NOTES-I07 NOTES-B10 NOTES-B11 NOTES-A07 trash keeps task links, restore keeps the archive state, purge nulls the link', async () => {
  const created = await note('Retro');
  const linked = await task('Fix onboarding', { sourceNoteId: created.id });
  const archived = await run((ctx) => service.archiveNote(ctx, created.id, 1));
  expect(archived.archivedAt).not.toBeNull();
  expect((await run((ctx) => service.archiveNote(ctx, created.id, 2))).revision).toBe(2);
  const { opId } = await run((ctx) => service.removeNote(ctx, created.id, 2));
  await expect(run((ctx) => service.getNote(ctx, created.id))).rejects.toMatchObject({
    code: 'not_found',
  });
  const trashed = await run((ctx) => getTask(ctx, linked.id));
  expect(trashed.sourceNote?.id).toBe(created.id);
  expect(trashed.sourceNote?.deletedAt).not.toBeNull();
  expect((await list({ view: 'trash' })).data.map((row) => row.id)).toEqual([created.id]);
  await expect(
    run((ctx) => service.restoreNote(ctx, created.id, crypto.randomUUID())),
  ).rejects.toMatchObject({ code: 'conflict' });
  const restored = await run((ctx) => service.restoreNote(ctx, created.id, opId));
  expect(restored.archivedAt).not.toBeNull();
  expect(restored.tasks.map((row) => row.id)).toEqual([linked.id]);
  const unarchived = await run((ctx) => service.unarchiveNote(ctx, created.id, restored.revision));
  expect(unarchived.archivedAt).toBeNull();
  await db().delete(notes).where(eq(notes.id, created.id));
  expect((await run((ctx) => getTask(ctx, linked.id))).sourceNote).toBeNull();
});
it('NOTES-B02 NOTES-B03 NOTES-B05 views equal their counts under facets and archived notes appear only when searching', async () => {
  const timezone = await getSetting(db(), 'workspace.timezone');
  const today = dayAt(timezone);
  const who = await person('Daniel Rowan');
  const recent = await note('Budget review', {
    type: 'board_meeting',
    tags: ['Budget'],
    participantIds: [who.id],
  });
  const older = await note('Site visit', { type: 'other', noteDate: addDays(today, -10) });
  const parked = await note('Old budget idea', { tags: ['budget'] });
  await run((ctx) => service.archiveNote(ctx, parked.id, 1));
  const gone = await note('Mistake');
  await run((ctx) => service.removeNote(ctx, gone.id, 1));
  const all = await list();
  expect(all.data.map((row) => row.title)).toEqual(['Budget review', 'Site visit']);
  expect(all.meta.counts).toMatchObject({
    all: 2,
    this_week: 1,
    'type:board_meeting': 1,
    'type:other': 1,
    archived: 1,
    trash: 1,
  });
  expect(all.data.map((row) => row.band)).toEqual(['today', 'month']);
  expect((await list({ view: 'this_week' })).data.map((row) => row.id)).toEqual([recent.id]);
  expect((await list({ view: 'archived' })).data.map((row) => row.id)).toEqual([parked.id]);
  const searched = await list({ q: 'budget' });
  expect(searched.data.map((row) => row.title)).toEqual(['Old budget idea', 'Budget review']);
  expect(searched.data[0]?.archivedAt).not.toBeNull();
  expect(searched.data[1]?.archivedAt).toBeNull();
  expect(searched.meta.counts.all).toBe(2);
  expect((await list({ tag: 'BUDGET' })).data.map((row) => row.id)).toEqual([recent.id]);
  expect((await list({ personId: who.id })).data.map((row) => row.id)).toEqual([recent.id]);
  expect((await list({ to: addDays(today, -1) })).data.map((row) => row.id)).toEqual([older.id]);
  expect((await list({ type: 'other' })).meta.counts.all).toBe(1);
  expect((await list({ sort: 'title' })).data.map((row) => row.title)).toEqual([
    'Budget review',
    'Site visit',
  ]);
  await expect(list({ view: 'type:missing' })).rejects.toMatchObject({ code: 'validation_failed' });
});
it('NOTES-B04 NOTES-A08 search normalizes Arabic and matches tags and participant names', async () => {
  const who = await person('سامر منصور');
  const created = await note('إِعداد الميزانية', {
    content: 'نقاط النقاش',
    tags: ['مُتابعة'],
    participantIds: [who.id],
  });
  await note('Unrelated');
  for (const q of ['اعداد', 'متابعة', 'سامر', 'النقاش'])
    expect(
      (await list({ q })).data.map((row) => row.id),
      q,
    ).toEqual([created.id]);
  expect((await list({ q: 'nothing' })).data).toEqual([]);
});
it('NOTES-B05 cursors continue across pages and reject changed filters', async () => {
  for (const title of ['One', 'Two', 'Three']) await note(title);
  const first = await list({ limit: '2' });
  expect(first.data).toHaveLength(2);
  expect(first.meta.nextCursor).not.toBeNull();
  const cursor = first.meta.nextCursor ?? '';
  const second = await list({ limit: '2', cursor });
  expect(second.data).toHaveLength(1);
  expect(second.meta.nextCursor).toBeNull();
  const ids = [...first.data, ...second.data].map((row) => row.id);
  expect(new Set(ids).size).toBe(3);
  await expect(list({ limit: '2', cursor, q: 'x' })).rejects.toMatchObject({
    code: 'validation_failed',
  });
});
it('NOTES-B12 NOTES-A06 bulk archive and bulk tag change everything or nothing', async () => {
  const [a, b, c] = await Promise.all([note('A'), note('B'), note('C')]);
  if (!a || !b || !c) throw new Error('notes missing');
  const items = (revisionOfB: number) => [
    { id: a.id, revision: 1 },
    { id: b.id, revision: revisionOfB },
    { id: c.id, revision: 1 },
  ];
  await expect(
    run((ctx) => service.bulkArchive(ctx, BulkItems.parse({ items: items(9) }))),
  ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'revision', id: b.id } });
  expect((await list({ view: 'archived' })).data).toEqual([]);
  await run((ctx) => service.archiveNote(ctx, c.id, 1));
  const archived = await run((ctx) =>
    service.bulkArchive(
      ctx,
      BulkItems.parse({ items: [...items(1).slice(0, 2), { id: c.id, revision: 2 }] }),
    ),
  );
  expect(archived.data.updatedIds).toEqual([a.id, b.id]);
  expect((await list({ view: 'archived' })).meta.counts.archived).toBe(3);
  const full = await note('Full', { tags: Array.from({ length: 10 }, (_, i) => `t${i}`) });
  await expect(
    run((ctx) =>
      service.bulkTag(
        ctx,
        BulkTag.parse({
          items: [
            { id: full.id, revision: 1 },
            { id: a.id, revision: 2 },
          ],
          tag: 'x',
        }),
      ),
    ),
  ).rejects.toMatchObject({ details: { rule: 'NOTES-I03', id: full.id } });
  expect((await run((ctx) => service.getNote(ctx, a.id))).tags).toEqual([]);
  const tagged = await run((ctx) =>
    service.bulkTag(
      ctx,
      BulkTag.parse({
        items: [
          { id: a.id, revision: 2 },
          { id: full.id, revision: 1 },
        ],
        tag: 'T0',
      }),
    ),
  );
  expect(tagged.data.updatedIds).toEqual([a.id]);
  expect((await run((ctx) => service.getNote(ctx, a.id))).tags).toEqual(['T0']);
});
it('NOTES-B13 lists distinct tags with counts over non-deleted notes', async () => {
  await note('One', { tags: ['Budget', 'Risk'] });
  await note('Two', { tags: ['budget'] });
  const gone = await note('Three', { tags: ['Ghost'] });
  await run((ctx) => service.removeNote(ctx, gone.id, 1));
  expect((await run((ctx) => service.listTags(ctx))).data).toEqual([
    { tag: 'Budget', count: 1 },
    { tag: 'budget', count: 1 },
    { tag: 'Risk', count: 1 },
  ]);
});
it('NOTES-B14 NOTES-A11 HOME-B01 home summary lists recent notes and skips archived and older ones', async () => {
  const timezone = await getSetting(db(), 'workspace.timezone');
  const today = dayAt(timezone);
  const fresh = await note('Fresh');
  await note('Old', { noteDate: addDays(today, -8) });
  const parked = await note('Parked');
  await run((ctx) => service.archiveNote(ctx, parked.id, 1));
  const [section] = await run((ctx) => service.homeSummary(ctx));
  expect(section).toMatchObject({ key: 'notes', enabled: true, count: 1 });
  expect(section?.items.map((item) => item.id)).toEqual([fresh.id]);
  expect(section?.href).toContain('view=this_week');
  await db().execute(sql`delete from notes`);
  expect((await run((ctx) => service.homeSummary(ctx)))[0]?.count).toBe(0);
  void tasks;
});
