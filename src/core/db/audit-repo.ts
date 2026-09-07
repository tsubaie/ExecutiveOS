import 'server-only';
import { z } from 'zod';
import { auditLog } from './system-schema';
import { type Database } from './client';
import { id } from './ids';
type Json = z.infer<ReturnType<typeof z.json>>;
// Dates and undefined values become JSON before they reach the audit row or an error payload.
export function toJson(value: object | Json): Json {
  return z.json().parse(JSON.parse(JSON.stringify(value)));
}
export async function writeAudit(
  database: Database,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  diff: Json,
  opId: string | null = null,
) {
  await database
    .insert(auditLog)
    .values({ id: id(), actorId, action, entityType, entityId, diff, opId });
}
