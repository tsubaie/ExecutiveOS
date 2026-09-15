import 'server-only';
import {
  and,
  eq,
  isNull,
  isNotNull,
  sql,
  asc,
  inArray,
  ne,
  getTableColumns,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { tasks } from './schema/db';
import type { Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';
import { searchMatch, searchRank } from '@/core/db/search';
import { updateEntity, type EntityPatch } from '@/core/db/entity';
import {
  cursorColumns,
  cursorPredicate,
  filteredCounts,
  orderBy,
  type SortKey,
  type SortSpec,
} from '@/core/db/keyset';
export type NameOf = (personId: AnyPgColumn) => SQL<string | null>;
type Filters = {
  committeeId?: string;
  view: string;
  q: string;
  ownerId: string;
  priority: string;
  dueFrom: string;
  dueTo: string;
  hasSubtasks: string;
  sourceNoteId: string;
  hasSourceNote: string;
  parentId?: string | undefined;
  includeSubtasks?: string | undefined;
};
const children = sql<number>`(select count(*)::int from tasks c where c.parent_id = tasks.id and c.deleted_at is null)`;
const completed = sql<number>`(select count(*)::int from tasks c where c.parent_id = tasks.id and c.deleted_at is null and c.status = 'completed')`;
const sourceNote = sql`(select json_build_object('id', n.id, 'title', n.title, 'deletedAt', n.deleted_at, 'archivedAt', n.archived_at) from notes n where n.id = tasks.source_note_id)`;
const columns = (ownerName: NameOf) => ({
  ...getTableColumns(tasks),
  committee: sql`(select json_build_object('id', c.id, 'name', c.name, 'status', c.status, 'deleted', c.deleted_at is not null) from committees c where c.id = tasks.committee_id)`,
  subtaskCount: children,
  completedSubtaskCount: completed,
  ownerName: ownerName(tasks.ownerId),
  sourceNote,
});
function noteFilters(f: Filters) {
  const predicates: SQL[] = [];
  if (f.committeeId) predicates.push(eq(tasks.committeeId, f.committeeId));
  if (f.sourceNoteId) predicates.push(eq(tasks.sourceNoteId, f.sourceNoteId));
  if (f.hasSourceNote)
    predicates.push(
      f.hasSourceNote === 'true' ? isNotNull(tasks.sourceNoteId) : isNull(tasks.sourceNoteId),
    );
  return predicates;
}
function base(f: Filters) {
  const predicates: SQL[] = noteFilters(f);
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
// Sort keys are total and non-null so keyset cursors continue exactly (TASKS-B07).
const priorityRank = sql`case ${tasks.priority} when 'urgent' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end`;
const dueKey = sql`coalesce(${tasks.dueDate}::text, '9999-12-31')`;
const micros = (column: AnyPgColumn) => sql`(extract(epoch from ${column}) * 1000000)::bigint`;
const idKey: SortKey = { expr: sql`${tasks.id}`, direction: 'desc' };
export function sortSpec(sort: string, today: string, week: string): SortSpec {
  const band = sql`case when ${tasks.status} = 'completed' then 5 when ${tasks.dueDate} < ${today} then 0 when ${tasks.dueDate} = ${today} then 1 when ${tasks.dueDate} <= ${week} then 2 when ${tasks.dueDate} is not null then 3 else 4 end`;
  const keys: Record<string, SortKey[]> = {
    title: [{ expr: sql`lower(${tasks.title})`, direction: 'asc' }, idKey],
    priority: [{ expr: priorityRank, direction: 'desc' }, idKey],
    created_at: [{ expr: micros(tasks.createdAt), direction: 'desc' }, idKey],
    updated_at: [{ expr: micros(tasks.updatedAt), direction: 'desc' }, idKey],
    due_date: [{ expr: dueKey, direction: 'asc' }, idKey],
  };
  return {
    id: sort,
    keys: keys[sort] ?? [
      { expr: band, direction: 'asc' },
      { expr: dueKey, direction: 'asc' },
      { expr: priorityRank, direction: 'desc' },
      { expr: micros(tasks.createdAt), direction: 'desc' },
      idKey,
    ],
  };
}
export async function selectTasks(
  database: Database,
  f: Filters,
  dates: string[],
  spec: SortSpec,
  limit: number,
  last: (string | number)[] | null,
  ownerName: NameOf,
) {
  const [today = '', week = '', cutoff = ''] = dates;
  return database
    .select({ ...columns(ownerName), ...cursorColumns(spec) })
    .from(tasks)
    .where(and(base(f), viewPredicate(f.view, today, week, cutoff), cursorPredicate(spec, last)))
    .orderBy(...orderBy(spec))
    .limit(limit);
}
export async function countTasks<V extends string>(
  database: Database,
  f: Filters,
  views: readonly V[],
  dates: string[],
) {
  const [today = '', week = '', cutoff = ''] = dates;
  const predicates = Object.fromEntries(
    views.map((view) => [view, viewPredicate(view, today, week, cutoff)]),
  ) as Record<V, SQL | undefined>; // cast: built from the same view list
  const [row] = await database
    .select(filteredCounts(predicates))
    .from(tasks)
    .where(base({ ...f, includeSubtasks: 'false', parentId: undefined }));
  return row;
}
export async function selectTask(database: Database, taskId: string, ownerName: NameOf) {
  const [row] = await database.select(columns(ownerName)).from(tasks).where(eq(tasks.id, taskId));
  return row;
}
export function selectChildren(
  database: Database,
  parentId: string,
  ownerName: NameOf,
  deleted = false,
) {
  return database
    .select(columns(ownerName))
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
export function updateTask(
  database: Database,
  taskId: string,
  revision: number,
  patch: EntityPatch<typeof tasks.$inferInsert>,
  actorId: string,
) {
  return updateEntity<typeof tasks.$inferSelect>(database, tasks, taskId, revision, patch, actorId);
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
    // HOME-B01: rows carry the facts the principal triages on, so the page never re-queries.
    columns[key + 'Items'] =
      sql`coalesce((select json_agg(item) from (select t.id, t.title, t.revision, t.due_date::text as date,
        p.full_name as owner, c.name as committee
        from tasks t left join people p on p.id = t.owner_id and p.deleted_at is null
        left join committees c on c.id = t.committee_id and c.deleted_at is null
        where t.id in (select id from tasks where ${predicate})
        order by t.due_date asc nulls last, t.id limit 5) item),'[]'::json)`;
  }
  // HOME-B09: how much of the overdue pile is a month or more past due. A total says how much is
  // late; this says whether it is a backlog or a crisis.
  columns['overdueStale'] =
    sql`count(*) filter (where ${predicates.overdue} and ${tasks.dueDate} < (${today}::date - 30))::int`;
  // HOME-B10: waiting is a chase list, so it aggregates by the person holding the work rather than
  // listing each task. One row per person, the people holding the most first.
  columns['waitingPeople'] =
    sql`coalesce((select json_agg(item) from (select p.id, p.full_name as title, count(*)::int as count
      from tasks t join people p on p.id = t.owner_id and p.deleted_at is null
      where t.id in (select id from tasks where ${predicates.waiting})
      group by p.id, p.full_name order by count(*) desc, lower(p.full_name), p.id limit 5) item),'[]'::json)`;
  const [row] = await database.select(columns).from(tasks);
  return row ?? {};
}
// SEARCH: the workspace-wide provider (ADR 0021). Subtasks are included — a subtask is a record
// the reader can open — and the committee is the line that tells two similar titles apart.
export async function searchTasks(database: Database, normalized: string, limit: number) {
  const committeeName = sql<
    string | null
  >`(select c.name from committees c where c.id = ${tasks.committeeId} and c.deleted_at is null)`;
  return database
    .select({
      id: tasks.id,
      title: tasks.title,
      subtitle: committeeName,
      rank: searchRank(tasks.title, normalized),
    })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), searchMatch(tasks.searchText, normalized)))
    .orderBy(searchRank(tasks.title, normalized), sql`${tasks.dueDate} nulls last`, tasks.title)
    .limit(limit);
}
// NOTIF-B06: the titles behind a page of notifications. Trashed tasks are absent, which is what
// drops their lines from the feed rather than leaving a link to nothing.
export async function selectTaskSubjects(database: Database, ids: readonly string[]) {
  if (!ids.length) return [];
  return database
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(inArray(tasks.id, [...ids]), isNull(tasks.deletedAt)));
}
