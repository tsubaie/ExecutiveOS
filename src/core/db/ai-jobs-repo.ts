import 'server-only';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { jobs, aiInvocations } from './system-schema';
import { type Database } from './client';
export async function lockAiAdmission(database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(7234)`);
}
export async function aiAdmissionUsage(
  database: Database,
  actor: string,
  kind: string,
  month: Date,
) {
  const [usage] = await database
    .select({
      tokens: sql<number>`coalesce(sum(${aiInvocations.inputTokens} + ${aiInvocations.outputTokens} + ${aiInvocations.cacheReadTokens} + ${aiInvocations.cacheWriteTokens}), 0)::float8`,
    })
    .from(aiInvocations)
    .where(gte(aiInvocations.createdAt, month));
  const [pending] = await database
    .select({
      tokens: sql<number>`coalesce(sum((${jobs.payload}->>'reservedTokens')::bigint), 0)::float8`,
    })
    .from(jobs)
    .where(and(sql`${jobs.kind} like 'ai.%'`, inArray(jobs.status, ['queued', 'running'])));
  const [recent] = await database
    .select({ count: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${jobs.createdAt})`.mapWith(jobs.createdAt) })
    .from(jobs)
    .where(
      and(
        eq(jobs.createdBy, actor),
        eq(jobs.kind, kind),
        gte(jobs.createdAt, new Date(Date.now() - 3600000)),
      ),
    );
  return { tokens: (usage?.tokens ?? 0) + (pending?.tokens ?? 0), count: recent?.count ?? 0,
    retryAfterMs: recent?.oldest ? Math.max(1000, recent.oldest.getTime() + 3600000 - Date.now()) : 0,
  };
}
export async function prepareAiJob(database: Database, jobId: string, entityId: string) {
  await database
    .update(jobs)
    .set({ entityId, maxAttempts: 2, deadlineAt: new Date(Date.now() + 15 * 60000) })
    .where(eq(jobs.id, jobId));
}
export async function latestAiJob(
  database: Database,
  actor: string,
  entityId: string,
  kind: string,
) {
  const [row] = await database
    .select()
    .from(jobs)
    .where(and(eq(jobs.entityId, entityId), eq(jobs.kind, kind), eq(jobs.createdBy, actor)))
    .orderBy(desc(jobs.createdAt), desc(jobs.id))
    .limit(1);
  return row;
}
export async function lockedAiJob(database: Database, jobId: string) {
  const [row] = await database.select().from(jobs).where(eq(jobs.id, jobId)).for('update');
  return row;
}
export async function updateAiResult(
  database: Database,
  jobId: string,
  result: typeof jobs.$inferInsert.result,
) {
  await database.update(jobs).set({ result }).where(eq(jobs.id, jobId));
}
export async function recordInvocation(
  database: Database,
  input: typeof aiInvocations.$inferInsert,
) {
  await database.insert(aiInvocations).values(input);
}

export async function aiUsage(database: Database, month: Date) {
  const [monthly] = await database.select({ tokens: sql<number>`coalesce(sum(${aiInvocations.inputTokens} + ${aiInvocations.outputTokens} + ${aiInvocations.cacheReadTokens} + ${aiInvocations.cacheWriteTokens}), 0)::float8` })
    .from(aiInvocations).where(gte(aiInvocations.createdAt, month));
  const [reserved] = await database.select({ tokens: sql<number>`coalesce(sum((${jobs.payload}->>'reservedTokens')::bigint), 0)::float8` })
    .from(jobs).where(and(sql`${jobs.kind} like 'ai.%'`, inArray(jobs.status, ['queued', 'running'])));
  const usage = await database.select({ capability: aiInvocations.capability, calls: sql<number>`count(*)::int`,
    inputTokens: sql<number>`sum(${aiInvocations.inputTokens})::float8`, outputTokens: sql<number>`sum(${aiInvocations.outputTokens})::float8`,
    cacheTokens: sql<number>`sum(${aiInvocations.cacheReadTokens} + ${aiInvocations.cacheWriteTokens})::float8`,
    estimatedCostMicros: sql<number>`coalesce(sum(${aiInvocations.estimatedCostMicros}), 0)::float8`,
  }).from(aiInvocations).where(gte(aiInvocations.createdAt, new Date(Date.now() - 30 * 86400000))).groupBy(aiInvocations.capability);
  return { usedTokens: monthly?.tokens ?? 0, reservedTokens: reserved?.tokens ?? 0, usage };
}

export async function lastInvocationError(database: Database, jobId: string) {
  const [row] = await database.select({ error: aiInvocations.error }).from(aiInvocations)
    .where(eq(aiInvocations.jobId, jobId)).orderBy(desc(aiInvocations.createdAt)).limit(1);
  return row?.error ?? null;
}

export async function recentModelOutcomes(database: Database, since: Date) {
  return database.select({
    model: sql<string>`distinct on (${aiInvocations.requestedModel}) ${aiInvocations.requestedModel}`,
    status: aiInvocations.status, error: aiInvocations.error,
  }).from(aiInvocations).where(gte(aiInvocations.createdAt, since))
    .orderBy(aiInvocations.requestedModel, desc(aiInvocations.createdAt));
}

export async function requestAiCancellation(database: Database, job: typeof jobs.$inferSelect) {
  await database.update(jobs).set({ cancelRequested: true,
    ...(job.status === 'queued' ? { status: 'cancelled', finishedAt: new Date() } : {}),
  }).where(eq(jobs.id, job.id));
}
