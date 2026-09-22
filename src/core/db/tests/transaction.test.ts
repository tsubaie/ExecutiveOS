import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { count, eq, sql } from 'drizzle-orm';
import { db, pool, type Database } from '../client';
import { migrateDatabase } from '../migrate';
import { enqueue, queueCapacity } from '../jobs-repo';
import { jobs } from '../system-schema';
import { transactional } from '../transaction';
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate jobs, job_attempts cascade`);
});
afterAll(() => pool().end());
const queued = async () => (await db().select({ n: count() }).from(jobs))[0]?.n ?? 0;
const twoWritesThenFail = transactional(async ({ db: database }: { db: Database }) => {
  await enqueue(database, 'system.noop', {}, 'first');
  await enqueue(database, 'system.noop', {}, 'second');
  throw new Error('injected after two writes');
});
it('ADMIN-B36 a service method called with the pool rolls back every write when a later step fails', async () => {
  await expect(twoWritesThenFail({ db: db() })).rejects.toThrow('injected');
  expect(await queued()).toBe(0);
});
it('ADMIN-B36 inside a request transaction a failed method rolls back only its own writes', async () => {
  await db().transaction(async (outer) => {
    await enqueue(outer, 'system.noop', {}, 'before');
    await expect(twoWritesThenFail({ db: outer })).rejects.toThrow('injected');
    await enqueue(outer, 'system.noop', {}, 'after');
  });
  const keys = (await db().select({ key: jobs.dedupKey }).from(jobs)).map((row) => row.key).sort();
  expect(keys).toEqual(['after', 'before']);
});
it('ADMIN-B37 a full queue refuses with a retryable queue-scoped rate limit, not a server error', async () => {
  await db().transaction(async (database) => {
    for (let index = 0; index < queueCapacity; index += 1)
      await enqueue(database, 'system.noop', {}, null);
  });
  await expect(enqueue(db(), 'system.noop', {}, null)).rejects.toMatchObject({
    code: 'rate_limited',
    details: { scope: 'queue', kind: 'system.noop', retryAfterSeconds: 30 },
  });
  expect(await queued()).toBe(queueCapacity);
  expect(await db().select().from(jobs).where(eq(jobs.kind, 'system.backup'))).toEqual([]);
});
