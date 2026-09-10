import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { harness } from './fixtures';
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(() => harness.reset());
afterAll(() => pool().end());
const insert = (title: string, tags: string) =>
  db().execute(
    sql`insert into notes (id, title, type, note_date, tags) values (gen_random_uuid(), ${title}, 'other', '2026-09-10', ${tags}::text[])`,
  );
it('NOTES-I01 NOTES-I03 the database rejects blank titles and more than ten tags', async () => {
  await expect(insert('   ', '{}')).rejects.toMatchObject({
    cause: { constraint: 'notes_title_check' },
  });
  await expect(insert('ok', '{a,b,c,d,e,f,g,h,i,j,k}')).rejects.toMatchObject({
    cause: { constraint: 'notes_tags_check' },
  });
  await expect(insert('ok', '{a,b,c,d,e,f,g,h,i,j}')).resolves.toBeTruthy();
});
it('NOTES-I04 the database rejects a second active participant row for the same person', async () => {
  const who = await harness.person('Twice');
  const created = await harness.note('Meeting', { participantIds: [who.id] });
  await expect(
    db().execute(
      sql`insert into note_people (id, note_id, person_id) values (gen_random_uuid(), ${created.id}::uuid, ${who.id}::uuid)`,
    ),
  ).rejects.toMatchObject({ cause: { constraint: 'note_people_active_idx' } });
  await db().execute(
    sql`update note_people set deleted_at = now(), deleted_op_id = gen_random_uuid() where note_id = ${created.id}::uuid`,
  );
  await expect(
    db().execute(
      sql`insert into note_people (id, note_id, person_id) values (gen_random_uuid(), ${created.id}::uuid, ${who.id}::uuid)`,
    ),
  ).resolves.toBeTruthy();
});
it('NOTES-I06 purging a note nulls source_note_id on its tasks and removes its participant rows', async () => {
  const who = await harness.person('Present');
  const created = await harness.note('Purge me', { participantIds: [who.id] });
  const linked = await harness.task('Linked', { sourceNoteId: created.id });
  await db().execute(sql`delete from notes where id = ${created.id}::uuid`);
  const [task] = (
    await db().execute(sql`select source_note_id from tasks where id = ${linked.id}::uuid`)
  ).rows;
  expect(task?.source_note_id).toBeNull();
  const [count] = (
    await db().execute(
      sql`select count(*)::int as count from note_people where note_id = ${created.id}::uuid`,
    )
  ).rows;
  expect(count?.count).toBe(0);
});
