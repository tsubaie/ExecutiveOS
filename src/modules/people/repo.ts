import 'server-only';
import {
  and,
  eq,
  isNull,
  isNotNull,
  sql,
  arrayContains,
  inArray,
  getTableColumns,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { people } from './schema/db';
import { type Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';
import { searchMatch, searchRank } from '@/core/db/search';
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

export function selectAiPeople(database: Database) {
  return database
    .select({ id: people.id, name: people.fullName, isAssignable: people.isAssignable })
    .from(people)
    .where(isNull(people.deletedAt));
}
// SEARCH: the workspace-wide provider (ADR 0021). Visibility is the list's own — a person in
// trash is not reachable here either (SEARCH-B05).
export async function searchPeople(database: Database, normalized: string, limit: number) {
  // `people.search_text` is declared by migration 0001 rather than by the Drizzle table, which is
  // why the list's own filter names it in raw SQL too.
  const corpus = sql`search_text`;
  const name = sql<string>`coalesce(${people.displayName}, ${people.fullName})`;
  return database
    .select({
      id: people.id,
      title: name,
      subtitle: people.organization,
      rank: searchRank(name, normalized),
    })
    .from(people)
    .where(and(isNull(people.deletedAt), searchMatch(corpus, normalized)))
    .orderBy(searchRank(name, normalized), sql`lower(${name})`)
    .limit(limit);
}
// ACCT-B05: the directory record linked to a login (ADR 0011). One row or none — `people.user_id`
// is unique — and it is read by user id because that is what the account knows about itself.
export async function selectPersonForUser(database: Database, userId: string) {
  const [row] = await database
    .select({
      id: people.id,
      fullName: people.fullName,
      organization: people.organization,
      roleTitle: people.roleTitle,
    })
    .from(people)
    .where(and(eq(people.userId, userId), isNull(people.deletedAt)));
  return row ?? null;
}
// NOTIF-B04: the accounts behind a set of directory records (ADR 0011). A person with no login —
// every external person — contributes nothing, which is how they never accumulate a feed.
export async function selectUserIdsForPeople(database: Database, personIds: readonly string[]) {
  if (!personIds.length) return [];
  const rows = await database
    .select({ userId: people.userId })
    .from(people)
    .where(and(inArray(people.id, [...personIds]), isNull(people.deletedAt)));
  return rows.flatMap((row) => (row.userId ? [row.userId] : []));
}
