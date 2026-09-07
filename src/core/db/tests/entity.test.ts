import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTableColumns, sql } from 'drizzle-orm';
import { db, pool } from '../client';
import { migrateDatabase } from '../migrate';
import { id } from '../ids';
import { insertUser } from '../auth-repo';
import { restoreEntity, selectEntity, softDeleteEntity, updateEntity } from '../entity';
import { toJson } from '../audit-repo';
import { people } from '@/modules/people/schema/db';
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  filteredCounts,
  filtersHash,
  orderBy,
  cursorColumns,
  type SortSpec,
} from '../keyset';
let actor: string;
type Row = typeof people.$inferSelect;
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate people, users cascade`);
  actor = (
    await insertUser(db(), {
      id: id(),
      name: 'E',
      email: 'e@example.test',
      passwordHash: 'x',
      role: 'admin',
    })
  ).id;
});
afterAll(() => pool().end());
async function person(fullName: string) {
  const [row] = await db()
    .insert(people)
    .values({ id: id(), fullName, createdBy: actor, updatedBy: actor })
    .returning();
  if (!row) throw new Error('insert failed');
  return row;
}
describe('core entity helpers', () => {
  it('PEOPLE-B06 TASKS-B12 stale revisions return undefined and successful updates bump revision and updated_at', async () => {
    const row = await person('Alpha');
    expect(
      await updateEntity<Row>(db(), people, row.id, row.revision + 5, { organization: 'X' }, actor),
    ).toBeUndefined();
    const updated = await updateEntity<Row>(
      db(),
      people,
      row.id,
      row.revision,
      { organization: 'Cedar' },
      actor,
    );
    expect(updated).toMatchObject({
      organization: 'Cedar',
      revision: row.revision + 1,
      updatedBy: actor,
    });
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(row.updatedAt.getTime());
    expect((await selectEntity<Row>(db(), people, row.id))?.organization).toBe('Cedar');
  });
  it('TASKS-I04 restore touches only rows carrying the operation id', async () => {
    const first = await person('First');
    const second = await person('Second');
    const opA = id();
    const opB = id();
    await softDeleteEntity(db(), people, first.id, first.revision, opA, actor);
    await softDeleteEntity(db(), people, second.id, second.revision, opB, actor);
    expect(await restoreEntity<Row>(db(), people, second.id, opA, actor)).toBeUndefined();
    const restored = await restoreEntity<Row>(db(), people, first.id, opA, actor);
    expect(restored).toMatchObject({
      deletedAt: null,
      deletedOpId: null,
      revision: first.revision + 2,
    });
    expect((await selectEntity<Row>(db(), people, second.id))?.deletedOpId).toBe(opB);
    expect(await restoreEntity<Row>(db(), people, first.id, opA, actor)).toBeUndefined();
  });
  it('ADMIN-B16 audit payloads serialize dates and drop undefined fields', () => {
    expect(toJson({ when: new Date('2026-01-02T03:04:05Z'), skip: undefined, n: 1 })).toEqual({
      when: '2026-01-02T03:04:05.000Z',
      n: 1,
    });
  });
});
describe('keyset pagination', () => {
  const spec: SortSpec = {
    id: 'name',
    keys: [
      { expr: sql`lower(${people.fullName})`, direction: 'asc' },
      { expr: sql`${people.id}`, direction: 'asc' },
    ],
  };
  async function page(last: (string | number)[] | null, limit: number) {
    return db()
      .select({ ...getTableColumns(people), ...cursorColumns(spec) })
      .from(people)
      .where(cursorPredicate(spec, last))
      .orderBy(...orderBy(spec))
      .limit(limit);
  }
  it('PEOPLE-B02 pages across duplicate names without repeats or gaps and rejects foreign cursors', async () => {
    for (const name of ['Same', 'Same', 'Same', 'Zed', 'Adam']) await person(name);
    const hash = filtersHash({ view: 'all' });
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let round = 0; round < 5; round += 1) {
      const rows = await page(decodeCursor(cursor ?? undefined, spec, hash), 2);
      seen.push(...rows.map((row) => row.id));
      const last = rows.at(-1);
      if (rows.length < 2 || !last) break;
      cursor = encodeCursor(spec, hash, last);
    }
    expect(new Set(seen).size).toBe(5);
    expect(seen).toHaveLength(5);
    expect(() => decodeCursor(cursor ?? '', spec, filtersHash({ view: 'internal' }))).toThrow();
    expect(() => decodeCursor(cursor ?? '', { ...spec, id: 'other' }, hash)).toThrow();
    expect(() => decodeCursor('not-base64', spec, hash)).toThrow();
  });
  it('PEOPLE-B02 filtered counts answer every view in one statement', async () => {
    await person('One');
    const second = await person('Two');
    await softDeleteEntity(db(), people, second.id, second.revision, id(), actor);
    const [row] = await db()
      .select(
        filteredCounts({
          all: sql`${people.deletedAt} is null`,
          trash: sql`${people.deletedAt} is not null`,
          everything: undefined,
        }),
      )
      .from(people);
    expect(row).toEqual({ all: 1, trash: 1, everything: 2 });
  });
});
