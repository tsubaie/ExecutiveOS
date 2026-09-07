import 'server-only';
import {
  and,
  eq,
  isNull,
  isNotNull,
  sql,
  arrayContains,
  getTableColumns,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { people } from './schema/db';
import { type Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';
import { restoreEntity, updateEntity, type EntityPatch } from '@/core/db/entity';
import {
  cursorColumns,
  cursorPredicate,
  filteredCounts,
  orderBy,
  type SortSpec,
} from '@/core/db/keyset';

type Filters = { view: string; q: string; tag: string; organization: string };
export const nameSort: SortSpec = {
  id: 'name',
  keys: [
    { expr: sql`lower(${people.fullName})`, direction: 'asc' },
    { expr: sql`${people.id}`, direction: 'asc' },
  ],
};
// Display name expression other modules may embed (owner labels); People owns its columns.
export function personNameSql(personId: AnyPgColumn) {
  return sql<
    string | null
  >`(select coalesce(p.display_name, p.full_name) from people p where p.id = ${personId})`;
}
function viewPredicate(view: string) {
  const where: SQL[] = [view === 'trash' ? isNotNull(people.deletedAt) : isNull(people.deletedAt)];
  if (view === 'assignable') where.push(eq(people.isAssignable, true));
  if (view === 'internal' || view === 'external') where.push(eq(people.kind, view));
  return and(...where);
}
function facets(filters: Omit<Filters, 'view'>) {
  const where: SQL[] = [];
  if (filters.organization) where.push(eq(people.organization, filters.organization));
  if (filters.tag) where.push(arrayContains(people.tags, [filters.tag]));
  if (filters.q)
    where.push(
      sql`search_text like ${'%' + normalize(filters.q).replace(/[\\%_]/g, '\\$&') + '%'}`,
    );
  return and(...where);
}
export async function selectPeople(
  database: Database,
  filters: Filters,
  limit: number,
  last: (string | number)[] | null,
) {
  return database
    .select({ ...getTableColumns(people), ...cursorColumns(nameSort) })
    .from(people)
    .where(and(facets(filters), viewPredicate(filters.view), cursorPredicate(nameSort, last)))
    .orderBy(...orderBy(nameSort))
    .limit(limit);
}
export async function countPeople<V extends string>(
  database: Database,
  filters: Omit<Filters, 'view'>,
  views: readonly V[],
) {
  const [row] = await database
    .select(
      filteredCounts(
        Object.fromEntries(views.map((view) => [view, viewPredicate(view)])) as Record<
          V,
          SQL | undefined
        >, // cast: built from the same view list
      ),
    )
    .from(people)
    .where(facets(filters));
  return row;
}
export async function selectPerson(database: Database, personId: string) {
  const [row] = await database.select().from(people).where(eq(people.id, personId));
  return row;
}
export async function possibleDuplicates(database: Database, name: string) {
  return database
    .select()
    .from(people)
    .where(and(isNull(people.deletedAt), eq(sql`lower(${people.fullName})`, name.toLowerCase())))
    .limit(20);
}
export async function lockPeopleCreate(database: Database, name: string) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${name.toLowerCase()},1))`,
  );
}
export async function insertPerson(database: Database, input: typeof people.$inferInsert) {
  const [row] = await database.insert(people).values(input).returning();
  if (!row) throw new Error('Person insert failed');
  return row;
}
export function updatePerson(
  database: Database,
  personId: string,
  revision: number,
  patch: EntityPatch<typeof people.$inferInsert>,
  actorId: string,
) {
  return updateEntity<typeof people.$inferSelect>(
    database,
    people,
    personId,
    revision,
    patch,
    actorId,
  );
}
export function restorePerson(database: Database, personId: string, opId: string, actorId: string) {
  return restoreEntity<typeof people.$inferSelect>(database, people, personId, opId, actorId);
}
