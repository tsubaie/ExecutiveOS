import 'server-only';
import { is, sql } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Database } from './client';
// Catalog reflection for audit:schema. Read-only; no business meaning.
export type TableShape = {
  name: string;
  columns: { name: string; notNull: boolean }[];
  indexes: string[];
  checks: string[];
  foreignKeyColumns: string[][];
};
export type DbTable = {
  name: string;
  columns: { name: string; nullable: boolean; generated: boolean }[];
  indexes: { name: string; definition: string }[];
  constraints: { name: string; type: string; definition: string }[];
  triggers: string[];
};
export function shapeOf(candidate: object): TableShape | null {
  if (!is(candidate, PgTable)) return null;
  const config = getTableConfig(candidate);
  return {
    name: config.name,
    columns: config.columns.map((column) => ({ name: column.name, notNull: column.notNull })),
    indexes: config.indexes.map((index) => index.config.name ?? ''),
    checks: config.checks.map((check) => check.name),
    foreignKeyColumns: config.foreignKeys.map((key) =>
      key.reference().columns.map((column) => column.name),
    ),
  };
}
const Names = z.array(z.object({ name: z.string() }));
async function names(database: Database, query: ReturnType<typeof sql>) {
  return Names.parse((await database.execute(query)).rows).map((row) => row.name);
}
export function listTables(database: Database) {
  return names(
    database,
    sql`select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
  );
}
export function listFunctions(database: Database) {
  return names(
    database,
    sql`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') order by 1`,
  );
}
export function listExtensions(database: Database) {
  return names(database, sql`select extname as name from pg_extension order by 1`);
}
export async function describeTable(database: Database, table: string): Promise<DbTable> {
  const columns = z
    .array(z.object({ column_name: z.string(), is_nullable: z.string(), is_generated: z.string() }))
    .parse(
      (
        await database.execute(
          sql`select column_name, is_nullable, is_generated from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`,
        )
      ).rows,
    );
  const indexes = z
    .array(z.object({ indexname: z.string(), indexdef: z.string() }))
    .parse(
      (
        await database.execute(
          sql`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = ${table} order by 1`,
        )
      ).rows,
    );
  const constraints = z
    .array(z.object({ conname: z.string(), contype: z.string(), definition: z.string() }))
    .parse(
      (
        await database.execute(
          sql`select conname, contype, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = format('public.%I', ${table}::text)::regclass order by 1`,
        )
      ).rows,
    );
  const triggers = await names(
    database,
    sql`select tgname as name from pg_trigger where tgrelid = format('public.%I', ${table}::text)::regclass and not tgisinternal order by 1`,
  );
  return {
    name: table,
    columns: columns.map((c) => ({
      name: c.column_name,
      nullable: c.is_nullable === 'YES',
      generated: c.is_generated !== 'NEVER',
    })),
    indexes: indexes.map((i) => ({ name: i.indexname, definition: i.indexdef })),
    constraints: constraints.map((c) => ({
      name: c.conname,
      type: c.contype,
      definition: c.definition,
    })),
    triggers,
  };
}
