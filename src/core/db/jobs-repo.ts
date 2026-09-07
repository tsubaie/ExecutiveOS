import 'server-only';
import { and, eq, gt, lte, isNull, or, sql, desc, count, inArray, lt } from 'drizzle-orm';
import {
  jobs,
  jobAttempts,
  schedules,
  loginAttempts,
  sessions,
  idempotencyKeys,
} from './system-schema';
import { db, type Database } from './client';
import { id } from './ids';
import type { z } from 'zod';
export type Claimed = typeof jobs.$inferSelect;
export async function enqueue(
  database: Database,
  kind: string,
  payload: z.infer<ReturnType<typeof z.json>>,
  dedupKey: string | null,
  actorId: string | null = null,
) {
  await database.execute(sql`select pg_advisory_xact_lock(7234)`);
  const [existing] = dedupKey
    ? await database
        .select()
        .from(jobs)
        .where(and(eq(jobs.dedupKey, dedupKey), inArray(jobs.status, ['queued', 'running'])))
    : [];
  if (existing) return existing;
  const [depth] = await database
    .select({ count: count() })
    .from(jobs)
    .where(and(eq(jobs.kind, kind), inArray(jobs.status, ['queued', 'running'])));
  if ((depth?.count ?? 0) >= 100) throw new Error('Queue capacity exceeded');
  const [row] = await database
    .insert(jobs)
    .values({ id: id(), kind, payload, dedupKey, createdBy: actorId })
    .returning();
  if (!row) throw new Error('Job insert failed');
  return row;
}
export async function claim(owner: string, kind: string, concurrency: number, globalLimit: number) {
  return db().transaction(async (database) => {
    await database.execute(sql`select pg_advisory_xact_lock(7234)`);
    const now = new Date();
    if (!(await admits(database, kind, concurrency, globalLimit, now))) return null;
    await sweepQueue(database, now);
    const candidate = await selectCandidate(database, kind, now);
    if (!candidate) return null;
    return writeClaim(database, candidate, owner, now);
  });
}
async function admits(
  database: Database,
  kind: string,
  concurrency: number,
  globalLimit: number,
  now: Date,
) {
  const active = await database
    .select({ kind: jobs.kind })
    .from(jobs)
    .where(and(eq(jobs.status, 'running'), gt(jobs.leaseExpiresAt, now)));
  return (
    active.length < globalLimit && active.filter((row) => row.kind === kind).length < concurrency
  );
}
async function sweepQueue(database: Database, now: Date) {
  await database
    .update(jobs)
    .set({ status: 'cancelled', finishedAt: now })
    .where(and(eq(jobs.status, 'queued'), eq(jobs.cancelRequested, true)));
  await database
    .update(jobs)
    .set({ status: 'failed', lastError: 'deadline_exceeded', finishedAt: now })
    .where(and(inArray(jobs.status, ['queued', 'running']), lte(jobs.deadlineAt, now)));
}
async function selectCandidate(database: Database, kind: string, now: Date) {
  const [candidate] = await database
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, kind),
        eq(jobs.cancelRequested, false),
        or(isNull(jobs.deadlineAt), gt(jobs.deadlineAt, now)),
        lt(jobs.attempt, jobs.maxAttempts),
        or(
          and(eq(jobs.status, 'queued'), lte(jobs.runAfter, now)),
          and(eq(jobs.status, 'running'), lte(jobs.leaseExpiresAt, now)),
        ),
      ),
    )
    .orderBy(desc(jobs.priority), jobs.createdAt)
    .limit(1)
    .for('update', { skipLocked: true });
  return candidate;
}
async function writeClaim(database: Database, candidate: Claimed, owner: string, now: Date) {
  if (candidate.status === 'running')
    await database
      .update(jobAttempts)
      .set({ status: 'abandoned', finishedAt: now, error: 'lease_expired' })
      .where(and(eq(jobAttempts.jobId, candidate.id), eq(jobAttempts.attempt, candidate.attempt)));
  const [row] = await database
    .update(jobs)
    .set({
      status: 'running',
      attempt: candidate.attempt + 1,
      leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + 120000),
      startedAt: now,
    })
    .where(eq(jobs.id, candidate.id))
    .returning();
  if (!row) throw new Error('Claim failed');
  await database.insert(jobAttempts).values({
    id: id(),
    jobId: row.id,
    attempt: row.attempt,
    leaseOwner: owner,
    status: 'running',
  });
  return row;
}
function fence(job: Claimed) {
  return and(
    eq(jobs.id, job.id),
    eq(jobs.attempt, job.attempt),
    eq(jobs.leaseOwner, job.leaseOwner ?? ''),
    eq(jobs.status, 'running'),
    gt(jobs.leaseExpiresAt, new Date()),
  );
}
export async function renew(job: Claimed) {
  const rows = await db()
    .update(jobs)
    .set({ leaseExpiresAt: new Date(Date.now() + 120000) })
    .where(
      and(
        fence(job),
        eq(jobs.cancelRequested, false),
        or(isNull(jobs.deadlineAt), gt(jobs.deadlineAt, new Date())),
      ),
    )
    .returning();
  return rows.length === 1;
}
export async function publish(
  job: Claimed,
  result: z.infer<ReturnType<typeof z.json>>,
  effect: (database: Database) => Promise<void> = async () => {},
) {
  await db().transaction(async (database) => {
    const rows = await database
      .update(jobs)
      .set({ status: 'succeeded', result, finishedAt: new Date(), leaseExpiresAt: null })
      .where(and(fence(job), eq(jobs.cancelRequested, false)))
      .returning();
    if (!rows.length) throw new Error('Job fence rejected');
    await effect(database);
    await database
      .update(jobAttempts)
      .set({ status: 'succeeded', finishedAt: new Date() })
      .where(and(eq(jobAttempts.jobId, job.id), eq(jobAttempts.attempt, job.attempt)));
  });
}
export async function fail(job: Claimed, error: string) {
  await db().transaction(async (database) => {
    const [current] = await database.select().from(jobs).where(fence(job));
    if (!current) return;
    const status = current.cancelRequested
      ? 'cancelled'
      : job.attempt < job.maxAttempts
        ? 'queued'
        : 'failed';
    const delay = [30000, 120000, 480000][job.attempt - 1] ?? 480000;
    const rows = await database
      .update(jobs)
      .set({
        status,
        lastError: error,
        runAfter: new Date(Date.now() + delay),
        finishedAt: status === 'queued' ? null : new Date(),
        leaseExpiresAt: null,
      })
      .where(fence(job))
      .returning();
    if (rows.length)
      await database
        .update(jobAttempts)
        .set({ status: 'failed', error, finishedAt: new Date() })
        .where(and(eq(jobAttempts.jobId, job.id), eq(jobAttempts.attempt, job.attempt)));
  });
}
export function listJobs(database: Database) {
  return database
    .select()
    .from(jobs)
    .where(gt(jobs.createdAt, new Date(Date.now() - 7 * 86400000)))
    .orderBy(desc(jobs.createdAt))
    .limit(100);
}
export async function prune(database: Database) {
  await database
    .delete(loginAttempts)
    .where(lt(loginAttempts.createdAt, new Date(Date.now() - 30 * 86400000)));
  await database
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - 86400000)));
  await database.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
export async function dueSchedules(database: Database) {
  return database
    .select()
    .from(schedules)
    .where(eq(schedules.enabled, true))
    .for('update', { skipLocked: true });
}
export async function markOccurrence(database: Database, scheduleId: string, occurrence: Date) {
  await database
    .update(schedules)
    .set({ lastOccurrence: occurrence, updatedAt: new Date() })
    .where(eq(schedules.id, scheduleId));
}
export async function jobsHealth() {
  return db()
    .select({
      status: jobs.status,
      count: count(),
      oldest: sql<Date | null>`min(${jobs.createdAt})`,
    })
    .from(jobs)
    .where(inArray(jobs.status, ['queued', 'running']))
    .groupBy(jobs.status);
}
