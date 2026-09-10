import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { countQueries } from '@/core/db/query-log';
import { NoteListQuery } from '../schema/validation';
import * as service from '../service';
import * as repo from '../repo';
import { harness } from './fixtures';
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(() => harness.reset());
afterAll(() => pool().end());
it('NOTES-B02 selects the page with every view count in one statement', async () => {
  await harness.note('One', { tags: ['x'] });
  await harness.note('Two');
  const query = NoteListQuery.parse({ q: 'o' });
  const views = service.viewsFor(['board_meeting', 'other']);
  const dates = { today: '2026-09-10', weekStart: '2026-09-04' };
  const { result, queries } = await countQueries(() =>
    repo.selectNotes(db(), query, dates, views, repo.sortSpec('default'), 10, null),
  );
  expect(queries).toBe(1);
  expect(result).toHaveLength(2);
  expect(result[0]?.counts).toMatchObject({ all: 2, archived: 0, trash: 0, 'type:other': 0 });
  const empty = await repo.selectNotes(
    db(),
    NoteListQuery.parse({ q: 'zzz' }),
    dates,
    views,
    repo.sortSpec('title'),
    10,
    null,
  );
  expect(empty).toEqual([]);
  expect(
    await repo.countNotes(db(), NoteListQuery.parse({ q: 'zzz' }), dates, views),
  ).toMatchObject({ all: 0 });
});
