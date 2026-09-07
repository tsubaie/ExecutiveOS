import 'server-only';
import { and, eq, gt, sql } from 'drizzle-orm';
import { idempotencyKeys, auditLog, workspace } from './system-schema';
import { type Database } from './client';
import type { z } from 'zod';
import { id } from './ids';
export async function lockRequest(database: Database, key: string) {
  await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`);
}
export async function replayRequest(database: Database, userId: string, key: string) {
  const [row] = await database
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.createdAt, new Date(Date.now() - 86400000)),
      ),
    );
  return row;
}
export async function storeRequest(
  database: Database,
  userId: string,
  key: string,
  requestHash: string,
  status: number,
  body: z.infer<ReturnType<typeof z.json>>,
) {
  await database
    .insert(idempotencyKeys)
    .values({ userId, key, requestHash, status, body })
    .onConflictDoUpdate({
      target: [idempotencyKeys.userId, idempotencyKeys.key],
      set: { requestHash, status, body, createdAt: new Date() },
    });
}
export async function writeAudit(
  database: Database,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  diff: z.infer<ReturnType<typeof z.json>>,
  opId: string | null = null,
) {
  await database
    .insert(auditLog)
    .values({ id: id(), actorId, action, entityType, entityId, diff, opId });
}
export async function maintenance(database: Database) {
  const [row] = await database.select({ enabled: workspace.maintenanceMode }).from(workspace);
  return row?.enabled ?? false;
}
