import 'server-only';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { PgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { Database } from './client';
// Shared data access for entity tables (docs/03 § Table classes): revision-checked updates,
// soft delete with operation provenance, and restore by operation id. Repos wrap these with their
// table and row type; services never touch them directly.
// Optional keys may carry undefined so callers can spread parsed PATCH bodies.
export type EntityPatch<Insert> = { [K in keyof Insert]?: Insert[K] | undefined };
export type EntityTable = PgTable & {
  id: PgColumn;
  revision: PgColumn;
  updatedAt: PgColumn;
  updatedBy: PgColumn;
  deletedAt: PgColumn;
  deletedOpId: PgColumn;
};
function stamped(table: EntityTable, patch: object, actorId: string) {
  const values = {
    ...patch,
    updatedBy: actorId,
    updatedAt: new Date(),
    revision: sql`${table.revision} + 1`,
  };
  return values as PgUpdateSetSource<EntityTable>; // cast: patch keys are the table's own columns
}
export async function selectEntity<Row>(database: Database, table: EntityTable, entityId: string) {
  const rows = await database.select().from(table).where(eq(table.id, entityId));
  return rows[0] as Row | undefined; // cast: Drizzle row to the repo's declared row type
}
export async function updateEntity<Row>(
  database: Database,
  table: EntityTable,
  entityId: string,
  revision: number,
  patch: object,
  actorId: string,
) {
  const rows = await database
    .update(table)
    .set(stamped(table, patch, actorId))
    .where(and(eq(table.id, entityId), eq(table.revision, revision)))
    .returning();
  return rows[0] as Row | undefined; // cast: Drizzle row to the repo's declared row type
}
export function softDeleteEntity<Row>(
  database: Database,
  table: EntityTable,
  entityId: string,
  revision: number,
  opId: string,
  actorId: string,
) {
  const patch = { deletedAt: new Date(), deletedOpId: opId };
  return updateEntity<Row>(database, table, entityId, revision, patch, actorId);
}
// Restores exactly the row carrying `opId` (docs/03 § Soft delete and provenance).
export async function restoreEntity<Row>(
  database: Database,
  table: EntityTable,
  entityId: string,
  opId: string,
  actorId: string,
  extra: object = {},
) {
  const rows = await database
    .update(table)
    .set(stamped(table, { ...extra, deletedAt: null, deletedOpId: null }, actorId))
    .where(and(eq(table.id, entityId), eq(table.deletedOpId, opId), isNotNull(table.deletedAt)))
    .returning();
  return rows[0] as Row | undefined; // cast: Drizzle row to the repo's declared row type
}
