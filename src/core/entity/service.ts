import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { toJson, writeAudit } from '@/core/db/audit-repo';
import { AppError } from '@/core/http/errors';
// Service-side composition of the entity rules every module shares: revision conflicts carry the
// current row, every write leaves an audit entry, restores are keyed by operation id.
type Json = z.infer<ReturnType<typeof z.json>>;
type Versioned = { id: string; revision: number };
export type EntityOps<T extends Versioned, Row extends object, P extends object = object> = {
  entityType: string;
  get: (ctx: Context, entityId: string, includeDeleted?: boolean) => Promise<T>;
  update: (ctx: Context, entityId: string, revision: number, patch: P) => Promise<Row | undefined>;
  restore?: (
    ctx: Context,
    entityId: string,
    opId: string,
    extra?: object,
  ) => Promise<Row | undefined>;
};
export function revisionConflict(current: object) {
  return new AppError('conflict', { reason: 'revision', current: toJson(current) });
}
export async function requireRevision<T extends Versioned, Row extends object, P extends object>(
  ctx: Context,
  ops: EntityOps<T, Row, P>,
  entityId: string,
  revision: number,
  includeDeleted = false,
) {
  const current = await ops.get(ctx, entityId, includeDeleted);
  if (current.revision !== revision) throw revisionConflict(current);
  return current;
}
export type AuditOptions = { action?: string; opId?: string | null; diff?: Json };
export async function applyUpdate<T extends Versioned, Row extends object, P extends object>(
  ctx: Context,
  ops: EntityOps<T, Row, P>,
  current: Versioned,
  patch: P,
  audit: AuditOptions = {},
): Promise<Row> {
  const row = await ops.update(ctx, current.id, current.revision, patch);
  if (!row) throw revisionConflict(await ops.get(ctx, current.id, true));
  await writeAudit(
    ctx.db,
    ctx.user.id,
    audit.action ?? 'update',
    ops.entityType,
    current.id,
    audit.diff ?? toJson(patch),
    audit.opId ?? null,
  );
  return row;
}
export async function restoreByOp<T extends Versioned, Row extends object, P extends object>(
  ctx: Context,
  ops: EntityOps<T, Row, P>,
  entityId: string,
  opId: string,
  extra?: object,
): Promise<Row> {
  if (!ops.restore) throw new Error(`${ops.entityType} cannot be restored`);
  const row = await ops.restore(ctx, entityId, opId, extra);
  if (!row) throw new AppError('conflict', { reason: 'state' });
  await writeAudit(ctx.db, ctx.user.id, 'restore', ops.entityType, entityId, {}, opId);
  return row;
}
