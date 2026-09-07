import 'server-only';
import {
  and,
  eq,
  isNull,
  isNotNull,
  sql,
  asc,
  desc,
  inArray,
  ne,
  getTableColumns,
  type SQL,
} from 'drizzle-orm';
import { tasks } from './schema/db';
import type { Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';
type Filters = {
  view: string;
  q: string;
  ownerId: string;
  priority: string;
  dueFrom: string;
  dueTo: string;
  hasSubtasks: string;
  parentId?: string | undefined;
  includeSubtasks?: string | undefined;
};
const children = sql<number>`(select count(*)::int from tasks c where c.parent_id = tasks.id and c.deleted_at is null)`;
const completed = sql<number>`(select count(*)::int from tasks c where c.parent_id = tasks.id and c.deleted_at is null and c.status = 'completed')`;
const columns = () => ({
  ...getTableColumns(tasks),
  subtaskCount: children,
  completedSubtaskCount: completed,
  ownerName: sql<
    string | null
  >`(select coalesce(p.display_name,p.full_name) from people p where p.id = tasks.owner_id)`,
});
function base(f: Filters) {
  const predicates: SQL[] = [];
  if (f.parentId) predicates.push(eq(tasks.parentId, f.parentId));
  else if (f.includeSubtasks !== 'true') predicates.push(isNull(tasks.parentId));
  if (f.ownerId) predicates.push(eq(tasks.ownerId, f.ownerId));
  if (f.priority) predicates.push(eq(tasks.priority, f.priority));
  if (f.dueFrom) predicates.push(sql`${tasks.dueDate} >= ${f.dueFrom}`);
  if (f.dueTo) predicates.push(sql`${tasks.dueDate} <= ${f.dueTo}`);
  if (f.hasSubtasks)
    predicates.push(f.hasSubtasks === 'true' ? sql`${children} > 0` : sql`${children} = 0`);
  if (f.q)
    predicates.push(
      sql`${tasks.searchText} like ${'%' + normalize(f.q).replace(/[\\%_]/g, '\\$&') + '%'}`,
    );
  return and(...predicates);
}
function viewPredicate(view: string, today: string, week: string, cutoff: string) {
  if (view === 'trash') return isNotNull(tasks.deletedAt);
  const predicates = [isNull(tasks.deletedAt)];
  if (view === 'completed')
    predicates.push(eq(tasks.status, 'completed'), sql`${tasks.completedAt} >= ${cutoff}::date`);
  else predicates.push(ne(tasks.status, 'completed'));
  const status = { inbox: 'inbox', next: 'next_action', waiting: 'waiting_on', someday: 'someday' }[
    view
  ];
  if (status) predicates.push(eq(tasks.status, status));
  if (view === 'today') predicates.push(sql`${tasks.dueDate} <= ${today}`);
  if (view === 'overdue') predicates.push(sql`${tasks.dueDate} < ${today}`);
  if (view === 'upcoming')
    predicates.push(sql`${tasks.dueDate} > ${today} and ${tasks.dueDate} <= ${week}`);
  return and(...predicates);
}
function order(sort: string, today: string, week: string) {
  const priority = sql`case ${tasks.priority} when 'urgent' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end`;
  if (sort === 'title') return [asc(sql`lower(${tasks.title})`), desc(tasks.id)];
  if (sort === 'priority') return [desc(priority), desc(tasks.id)];
  if (sort === 'created_at') return [desc(tasks.createdAt), desc(tasks.id)];
  if (sort === 'updated_at') return [desc(tasks.updatedAt), desc(tasks.id)];
  const due = sql`${tasks.dueDate} asc nulls last`;
  if (sort === 'due_date') return [due, desc(tasks.id)];
  const band = sql`case when ${tasks.status} = 'completed' then 5 when ${tasks.dueDate} < ${today} then 0 when ${tasks.dueDate} = ${today} then 1 when ${tasks.dueDate} <= ${week} then 2 when ${tasks.dueDate} is not null then 3 else 4 end`;
  return [asc(band), due, desc(priority), desc(tasks.createdAt), desc(tasks.id)];
}
export async function selectTasks(
  database: Database,
  f: Filters,
  dates: string[],
  sort: string,
  limit: number,
  after: string | null,
) {
  const [today = '', week = '', cutoff = ''] = dates;
  // The cursor is a full sort tuple captured as a JSON array; no offset or missing-anchor lookup.
  const ordering = order(sort, today, week);
  const keys = sortKeys(sort, today, week);
  const cursor = after
    ? sql`jsonb_build_array(${sql.join(keys, sql`, `)}) > ${after}::jsonb`
    : undefined;
  return database
    .select(columns())
    .from(tasks)
    .where(and(base(f), viewPredicate(f.view, today, week, cutoff), cursor))
    .orderBy(...ordering)
    .limit(limit);
}
function sortKeys(sort: string, today: string, week: string) {
  const reverseId = sql`translate(${tasks.id}::text,'0123456789abcdef','fedcba9876543210')`;
  const p = sql`case ${tasks.priority} when 'urgent' then -4 when 'high' then -3 when 'medium' then -2 when 'low' then -1 else 0 end`;
  const due = sql`coalesce(${tasks.dueDate}::text,'9999-12-31')`;
  if (sort === 'title') return [sql`lower(${tasks.title})`, reverseId];
  if (sort === 'priority') return [p, reverseId];
  if (sort === 'created_at') return [sql`-extract(epoch from ${tasks.createdAt})`, reverseId];
  if (sort === 'updated_at') return [sql`-extract(epoch from ${tasks.updatedAt})`, reverseId];
  if (sort === 'due_date') return [due, reverseId];
  return [
    sql`case when ${tasks.status} = 'completed' then 5 when ${tasks.dueDate} < ${today} then 0 when ${tasks.dueDate} = ${today} then 1 when ${tasks.dueDate} <= ${week} then 2 when ${tasks.dueDate} is not null then 3 else 4 end`,
    due,
    p,
    sql`-extract(epoch from ${tasks.createdAt})`,
    reverseId,
  ];
}
export async function cursorTuple(
  database: Database,
  taskId: string,
  sort: string,
  today: string,
  week: string,
) {
  const [row] = await database
    .select({
      tuple: sql<string>`jsonb_build_array(${sql.join(sortKeys(sort, today, week), sql`, `)})::text`,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  return row?.tuple ?? null;
}
export async function countTasks(database: Database, f: Filters, views: string[], dates: string[]) {
  const [today = '', week = '', cutoff = ''] = dates;
  const fields: Record<string, SQL<number>> = {};
  for (const view of views)
    fields[view] =
      sql<number>`count(*) filter (where ${viewPredicate(view, today, week, cutoff)})::int`;
  const [row] = await database
    .select(fields)
    .from(tasks)
    .where(base({ ...f, includeSubtasks: 'false', parentId: undefined }));
  return row ?? {};
}
export async function selectTask(database: Database, taskId: string) {
  const [row] = await database.select(columns()).from(tasks).where(eq(tasks.id, taskId));
  return row;
}
export function selectChildren(database: Database, parentId: string, deleted = false) {
  return database
    .select(columns())
    .from(tasks)
    .where(and(eq(tasks.parentId, parentId), deleted ? undefined : isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.sortOrder));
}
export async function lockTasks(database: Database) {
  // Serialize hierarchy changes, including independent child and parent writes, in one lock order.
  await database.execute(sql`select pg_advisory_xact_lock(7240)`);
}
export async function nextOrder(database: Database, parentId: string | null) {
  const [row] = await database
    .select({ next: sql<number>`coalesce(max(${tasks.sortOrder}),-1)+1` })
    .from(tasks)
    .where(parentId ? eq(tasks.parentId, parentId) : isNull(tasks.parentId));
  return row?.next ?? 0;
}
export async function insertTask(database: Database, input: typeof tasks.$inferInsert) {
  const [row] = await database.insert(tasks).values(input).returning();
  if (!row) throw new Error('Task insert failed');
  return row;
}
export async function updateTask(
  database: Database,
  taskId: string,
  revision: number,
  patch: { [K in keyof typeof tasks.$inferInsert]?: (typeof tasks.$inferInsert)[K] | undefined },
) {
  const [row] = await database
    .update(tasks)
    .set({ ...patch, revision: sql`${tasks.revision}+1`, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.revision, revision)))
    .returning();
  return row;
}
export async function reorderTasks(database: Database, orderedIds: string[], actorId: string) {
  await database
    .update(tasks)
    .set({
      sortOrder: sql`array_position(ARRAY[${sql.join(
        orderedIds.map((value) => sql`${value}::uuid`),
        sql`, `,
      )}],${tasks.id})-1`,
      updatedBy: actorId,
      updatedAt: new Date(),
      revision: sql`${tasks.revision}+1`,
    })
    .where(inArray(tasks.id, orderedIds));
}
export async function selectHomeSummary(database: Database, today: string) {
  const active = and(
    isNull(tasks.deletedAt),
    isNull(tasks.parentId),
    ne(tasks.status, 'completed'),
  );
  const predicates = {
    overdue: and(active, sql`${tasks.dueDate} < ${today}`),
    today: and(active, eq(tasks.dueDate, today)),
    waiting: and(active, eq(tasks.status, 'waiting_on'), isNotNull(tasks.ownerId)),
  };
  const columns: Record<string, SQL> = {};
  for (const [key, predicate] of Object.entries(predicates)) {
    columns[key + 'Count'] = sql`count(*) filter (where ${predicate})::int`;
    columns[key + 'Items'] =
      sql`coalesce((select json_agg(item) from (select id,title from tasks where ${predicate} order by due_date asc nulls last,id limit 5) item),'[]'::json)`;
  }
  const [row] = await database.select(columns).from(tasks);
  return row ?? {};
}
