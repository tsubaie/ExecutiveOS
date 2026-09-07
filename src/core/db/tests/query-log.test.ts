import { afterAll, beforeAll, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '../client';
import { migrateDatabase } from '../migrate';
import { countQueries } from '../query-log';
beforeAll(async () => {
  await migrateDatabase();
});
afterAll(() => pool().end());
it('counts every statement issued through the client, including inside a transaction', async () => {
  const { queries } = await countQueries(async () => {
    await db().transaction(async (database) => {
      for (let index = 0; index < 7; index += 1) await database.execute(sql`select ${index}`);
    });
  });
  expect(queries).toBe(7);
  const { queries: none } = await countQueries(async () => undefined);
  expect(none).toBe(0);
});
