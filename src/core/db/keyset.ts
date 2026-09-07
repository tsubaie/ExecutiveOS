import 'server-only';
import { createHash } from 'node:crypto';
import { and, asc, desc, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '@/core/http/errors';
// Keyset pagination declared once per sort: ORDER BY, the cursor tuple selected with the row, and
// the continuation predicate all derive from the same key list (docs/04 § Lists).
export type SortKey = { expr: SQL; direction: 'asc' | 'desc' };
export type SortSpec = { id: string; keys: SortKey[] };
type Json = z.infer<ReturnType<typeof z.json>>;
const CursorValue = z.union([z.string(), z.number()]);
const Cursor = z.object({
  v: z.literal(1),
  sort: z.string(),
  filtersHash: z.string(),
  last: z.array(CursorValue),
});
const cursorColumn = (index: number) => `__k${index}`;
export function orderBy(spec: SortSpec) {
  return spec.keys.map((key) => (key.direction === 'asc' ? asc(key.expr) : desc(key.expr)));
}
export function cursorColumns(spec: SortSpec) {
  return Object.fromEntries(
    spec.keys.map((key, index) => [cursorColumn(index), sql<string | number>`${key.expr}`]),
  );
}
// Row-value comparison expanded per key so mixed directions and coalesced nulls work.
export function cursorPredicate(spec: SortSpec, last: (string | number)[] | null) {
  if (!last) return undefined;
  const clauses = spec.keys.map((key, index) =>
    and(
      ...spec.keys.slice(0, index).map((previous, j) => sql`${previous.expr} = ${last[j]}`),
      key.direction === 'asc'
        ? sql`${key.expr} > ${last[index]}`
        : sql`${key.expr} < ${last[index]}`,
    ),
  );
  return or(...clauses);
}
export function filtersHash(value: Json) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function encodeCursor(spec: SortSpec, hash: string, row: object) {
  const values = z
    .record(z.string(), z.union([CursorValue, z.date()]))
    .parse(Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('__k'))));
  const last = spec.keys.map((_, index) => {
    const value = values[cursorColumn(index)];
    return value instanceof Date ? value.toISOString() : (value ?? '');
  });
  return Buffer.from(JSON.stringify({ v: 1, sort: spec.id, filtersHash: hash, last })).toString(
    'base64url',
  );
}
export function decodeCursor(cursor: string | undefined, spec: SortSpec, hash: string) {
  if (!cursor) return null;
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    if (
      parsed.sort !== spec.id ||
      parsed.filtersHash !== hash ||
      parsed.last.length !== spec.keys.length
    )
      throw new Error('cursor mismatch');
    return parsed.last;
  } catch {
    throw new AppError('validation_failed', { fieldErrors: { cursor: ['cursor_mismatch'] } });
  }
}
// One SELECT with a filtered count per view instead of a query per view.
export function filteredCounts<K extends string>(predicates: Record<K, SQL | undefined>) {
  const fields = {} as Record<K, SQL<number>>; // cast: filled for every key below
  for (const key of Object.keys(predicates)) {
    const predicate = predicates[z.custom<K>().parse(key)];
    fields[z.custom<K>().parse(key)] = predicate
      ? sql<number>`count(*) filter (where ${predicate})::int`
      : sql<number>`count(*)::int`;
  }
  return fields;
}
