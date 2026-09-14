import 'server-only';
import { and, eq, isNull, isNotNull, sql, getTableColumns, type SQL } from 'drizzle-orm';
import type { Database } from '@/core/db/client';
import { auditLog } from '@/core/db/system-schema';
import { normalize } from '@/core/search/normalize';
import { updateEntity, restoreEntity, type EntityPatch } from '@/core/db/entity';
import { cursorColumns, cursorPredicate, orderBy, filteredCounts, type SortSpec, type SortKey } from '@/core/db/keyset';
import { committees } from './schema/db';
type CommitteeListQuery = { view: string; q: string; scope: string; sort: string; limit: number; cursor?: string | undefined };
const stats = (today: string) => sql`(select json_build_object(
  'open', count(*) filter (where t.status <> 'completed')::int,
  'completed', count(*) filter (where t.status = 'completed')::int,
  'overdue', count(*) filter (where t.status <> 'completed' and t.due_date < ${today}::date)::int,
  'today', count(*) filter (where t.status <> 'completed' and t.due_date = ${today}::date)::int)
  from tasks t where t.committee_id = committees.id and t.deleted_at is null and t.parent_id is null)`;
const lastNoteDate = sql<string | null>`(select max(n.note_date)::text from notes n where n.committee_id = committees.id and n.deleted_at is null)`;
const columns = (today: string) => ({ ...getTableColumns(committees), stats: stats(today), lastNoteDate });
const stat = (name: string, today: string) => sql`coalesce((${stats(today)} ->> ${name})::int, 0)`;
function base(query: CommitteeListQuery) {
  const pattern = '%' + normalize(query.q).replace(/[\\%_]/g, '\\$&') + '%';
  return and(query.scope ? eq(committees.scope, query.scope) : undefined,
    query.q ? sql`${committees.searchText} like ${pattern}` : undefined);
}
function viewFilter(view: string, today: string) {
  if (view === 'trash') return isNotNull(committees.deletedAt);
  return and(isNull(committees.deletedAt),
    ['active', 'archived'].includes(view) ? eq(committees.status, view) : undefined,
    ['open', 'completed', 'today', 'overdue'].includes(view) ? sql`${stat(view, today)} > 0` : undefined);
}
export function committeeSort(sort: string, today: string): SortSpec {
  const extra: Record<string, SortKey[]> = {
    status: [{ expr: sql`${committees.status}`, direction: 'asc' }],
    open_tasks: [{ expr: stat('open', today), direction: 'desc' }],
    manual: [{ expr: sql`${committees.sortOrder}`, direction: 'asc' }],
  };
  return { id: sort, keys: [
    { expr: sql`case when ${committees.scope} = 'internal' then 0 else 1 end`, direction: 'asc' },
    ...(extra[sort] ?? []), { expr: sql`lower(${committees.name})`, direction: 'asc' },
    { expr: sql`${committees.id}`, direction: 'asc' },
  ] };
}
export function selectCommittees(database: Database, query: CommitteeListQuery, today: string, spec: SortSpec, last: (string | number)[] | null) {
  return database.select({ ...columns(today), ...cursorColumns(spec) }).from(committees)
    .where(and(base(query), viewFilter(query.view, today), cursorPredicate(spec, last)))
    .orderBy(...orderBy(spec)).limit(query.limit + 1);
}
export async function committeeCounts(database: Database, query: CommitteeListQuery, today: string) {
  const filters: Record<string, SQL | undefined> = Object.fromEntries(['all', 'active', 'archived', 'trash', 'overdue', 'today', 'open', 'completed'].map((view) => [view, viewFilter(view, today)]));
  const [row] = await database.select(filteredCounts(filters)).from(committees).where(base(query));
  return row ?? {};
}
export async function taskStats(database: Database, query: CommitteeListQuery, today: string) {
  const sum = (name: string) => sql<number>`coalesce(sum(${stat(name, today)}), 0)::int`;
  const [row] = await database.select({ open: sum('open'), completed: sum('completed'), today: sum('today'), overdue: sum('overdue') })
    .from(committees).where(and(base(query), viewFilter(['active', 'archived', 'trash'].includes(query.view) ? query.view : 'all', today)));
  return row ?? { open: 0, completed: 0, today: 0, overdue: 0 };
}
export async function selectCommittee(database: Database, committeeId: string, today: string) {
  const [row] = await database.select(columns(today)).from(committees).where(eq(committees.id, committeeId));
  return row;
}
export function selectChoices(database: Database, current?: string) {
  return database.select({ id: committees.id, name: committees.name, status: committees.status,
    deleted: sql<boolean>`${committees.deletedAt} is not null` }).from(committees)
    .where(sql`(${committees.deletedAt} is null and ${committees.status} = 'active') or ${committees.id} = ${current ?? null}::uuid`)
    .orderBy(sql`lower(${committees.name})`, committees.id);
}
export async function lockCommittees(database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(7311)`);
}
export async function duplicateName(database: Database, name: string, except?: string) {
  const [row] = await database.select({ id: committees.id }).from(committees)
    .where(and(isNull(committees.deletedAt), sql`lower(${committees.name}) = lower(${name})`, except ? sql`${committees.id} <> ${except}::uuid` : undefined)).limit(1);
  return Boolean(row);
}
export async function insertCommittee(database: Database, input: typeof committees.$inferInsert) {
  const [row] = await database.insert(committees).values({ ...input,
    sortOrder: sql`(select coalesce(max(sort_order), -1) + 1 from committees)` }).returning();
  if (!row) throw new Error('Committee insert failed');
  return row;
}
export function updateCommittee(database: Database, committeeId: string, revision: number, patch: EntityPatch<typeof committees.$inferInsert>, actor: string) {
  return updateEntity<typeof committees.$inferSelect>(database, committees, committeeId, revision, patch, actor);
}
export function restoreCommittee(database: Database, committeeId: string, opId: string, actor: string) {
  return restoreEntity<typeof committees.$inferSelect>(database, committees, committeeId, opId, actor);
}
export const activitySort: SortSpec = { id: 'activity', keys: [
  { expr: sql`(extract(epoch from ${auditLog.createdAt}) * 1000000)::bigint`, direction: 'desc' },
  { expr: sql`${auditLog.id}`, direction: 'desc' },
] };
export function selectActivity(database: Database, committeeId: string, last: (string | number)[] | null) {
  return database.select({ id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType,
    entityId: auditLog.entityId, createdAt: auditLog.createdAt, ...cursorColumns(activitySort) }).from(auditLog)
    .where(and(sql`((${auditLog.entityType} = 'committee' and ${auditLog.entityId} = ${committeeId}::uuid)
      or (${auditLog.entityType} = 'task' and ${auditLog.entityId} in (select id from tasks where committee_id = ${committeeId}::uuid))
      or (${auditLog.entityType} = 'note' and ${auditLog.entityId} in (select id from notes where committee_id = ${committeeId}::uuid)))`,
    cursorPredicate(activitySort, last))).orderBy(...orderBy(activitySort)).limit(51);
}
// HOME-B01: committees still carrying open top-level work, busiest first. One query, no cursor.
const openWork = sql`(select count(*) from tasks t where t.committee_id = committees.id
  and t.deleted_at is null and t.parent_id is null and t.status <> 'completed')`;
// HOME-B09: the late portion of each committee's open work, so the bars compare load and show how
// much of it has already slipped.
const lateWork = (today: string) => sql`(select count(*) from tasks t where t.committee_id = committees.id
  and t.deleted_at is null and t.parent_id is null and t.status <> 'completed' and t.due_date < ${today}::date)`;
// Completed top-level work, so a committee row can show how far along it is rather than only how
// much is left.
const doneWork = sql`(select count(*) from tasks t where t.committee_id = committees.id
  and t.deleted_at is null and t.parent_id is null and t.status = 'completed')`;
export async function selectHomeSummary(database: Database, today: string) {
  const carrying = and(isNull(committees.deletedAt), eq(committees.status, 'active'), sql`${openWork} > 0`);
  const [row] = await database.select({
    count: sql<number>`count(*)::int`,
    items: sql<{ id: string; title: string; count: number; owner: string; overdue: number; done: number }[]>`coalesce((select json_agg(item) from (
      select id, name as title, nullif(ownership, '') as owner, ${openWork} as count,
        ${lateWork(today)} as overdue, ${doneWork} as done
      from committees where ${carrying} order by ${openWork} desc, lower(name), id limit 5) item), '[]'::json)`,
  }).from(committees).where(carrying);
  return row ?? { count: 0, items: [] };
}
