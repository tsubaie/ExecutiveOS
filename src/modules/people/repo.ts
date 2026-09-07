import 'server-only';
import {
  and,
  eq,
  isNull,
  isNotNull,
  sql,
  asc,
  gt,
  or,
  count,
  arrayContains,
  type SQL,
} from 'drizzle-orm';
import { people } from './schema/db';
import { type Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';

type Filters = { view: string; q: string; tag: string; organization: string };
function predicate(filters: Filters) {
  const where: SQL[] = [];
  where.push(filters.view === 'trash' ? isNotNull(people.deletedAt) : isNull(people.deletedAt));
  if (filters.view === 'assignable') where.push(eq(people.isAssignable, true));
  if (filters.view === 'internal' || filters.view === 'external')
    where.push(eq(people.kind, filters.view));
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
  last?: { name: string; id: string },
) {
  const cursor = last
    ? or(
        gt(sql<string>`lower(${people.fullName})`, last.name),
        and(eq(sql<string>`lower(${people.fullName})`, last.name), gt(people.id, last.id)),
      )
    : undefined;
  return database
    .select()
    .from(people)
    .where(and(predicate(filters), cursor))
    .orderBy(asc(sql`lower(${people.fullName})`), asc(people.id))
    .limit(limit);
}
export async function countPeople(database: Database, filters: Filters) {
  const [row] = await database.select({ count: count() }).from(people).where(predicate(filters));
  return row?.count ?? 0;
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
export async function updatePerson(
  database: Database,
  personId: string,
  revision: number,
  patch: { [K in keyof typeof people.$inferInsert]?: (typeof people.$inferInsert)[K] | undefined },
) {
  const [row] = await database
    .update(people)
    .set({ ...patch, updatedAt: new Date(), revision: sql`${people.revision}+1` })
    .where(and(eq(people.id, personId), eq(people.revision, revision)))
    .returning();
  return row;
}
