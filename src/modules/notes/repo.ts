import 'server-only';
import { and, eq, isNull, isNotNull, inArray, sql, getTableColumns, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { notes, notePeople } from './schema/db';
import type { Database } from '@/core/db/client';
import { id } from '@/core/db/ids';
import { normalize } from '@/core/search/normalize';
import { restoreEntity, updateEntity, type EntityPatch } from '@/core/db/entity';
import {
  cursorColumns,
  cursorPredicate,
  filteredCounts,
  orderBy,
  type SortKey,
  type SortSpec,
} from '@/core/db/keyset';
type Filters = {
  view: string;
  q: string;
  type: string;
  tag: string;
  personId: string;
  from: string;
  to: string;
};
export type Dates = { today: string; weekStart: string };
const participants = sql`coalesce((select json_agg(json_build_object('id', p.id, 'name', coalesce(p.display_name, p.full_name), 'kind', p.kind) order by np.created_at, np.id) from note_people np join people p on p.id = np.person_id where np.note_id = notes.id and np.deleted_at is null and p.deleted_at is null), '[]'::json)`;
const openTasks = sql<number>`(select count(*)::int from tasks t where t.source_note_id = notes.id and t.deleted_at is null and t.status <> 'completed')`;
const doneTasks = sql<number>`(select count(*)::int from tasks t where t.source_note_id = notes.id and t.deleted_at is null and t.status = 'completed')`;
const columns = {
  ...getTableColumns(notes),
  participants,
  openTaskCount: openTasks,
  doneTaskCount: doneTasks,
};
const pattern = (q: string) => '%' + normalize(q).replace(/[\\%_]/g, '\\$&') + '%';
// NOTES-B04: title and content through search_text; tags and participant names by join.
function searchPredicate(q: string) {
  const like = pattern(q);
  return sql`(${notes.searchText} like ${like} or exists (select 1 from unnest(${notes.tags}) tag where eos_normalize(tag) like ${like}) or exists (select 1 from note_people np join people p on p.id = np.person_id where np.note_id = ${notes.id} and np.deleted_at is null and p.deleted_at is null and p.search_text like ${like}))`;
}
function base(f: Filters) {
  const predicates: SQL[] = [];
  if (f.type) predicates.push(eq(notes.type, f.type));
  if (f.tag)
    predicates.push(
      sql`exists (select 1 from unnest(${notes.tags}) tag where lower(tag) = lower(${f.tag}))`,
    );
  if (f.personId)
    predicates.push(
      sql`exists (select 1 from note_people np where np.note_id = ${notes.id} and np.person_id = ${f.personId}::uuid and np.deleted_at is null)`,
    );
  if (f.from) predicates.push(sql`${notes.noteDate} >= ${f.from}`);
  if (f.to) predicates.push(sql`${notes.noteDate} <= ${f.to}`);
  if (f.q) predicates.push(searchPredicate(f.q));
  return and(...predicates);
}
// NOTES-B02: archived notes leave every non-trash view unless the user is searching.
function viewPredicate(view: string, dates: Dates, searching: boolean) {
  if (view === 'trash') return isNotNull(notes.deletedAt);
  const predicates: SQL[] = [isNull(notes.deletedAt)];
  if (view === 'archived') predicates.push(isNotNull(notes.archivedAt));
  else if (!searching) predicates.push(isNull(notes.archivedAt));
  if (view === 'this_week')
    predicates.push(sql`${notes.noteDate} between ${dates.weekStart} and ${dates.today}`);
  if (view.startsWith('type:')) predicates.push(eq(notes.type, view.slice(5)));
  return and(...predicates);
}
const micros = (column: AnyPgColumn) => sql`(extract(epoch from ${column}) * 1000000)::bigint`;
const idKey: SortKey = { expr: sql`${notes.id}`, direction: 'desc' };
export function sortSpec(sort: string): SortSpec {
  const keys: Record<string, SortKey[]> = {
    title: [{ expr: sql`lower(${notes.title})`, direction: 'asc' }, idKey],
    created_at: [{ expr: micros(notes.createdAt), direction: 'desc' }, idKey],
  };
  return {
    id: sort,
    keys: keys[sort] ?? [
      { expr: sql`${notes.noteDate}::text`, direction: 'desc' },
      { expr: micros(notes.createdAt), direction: 'desc' },
      idKey,
    ],
  };
}
function viewPredicates(f: Filters, dates: Dates, views: readonly string[]) {
  return Object.fromEntries(
    views.map((view) => [view, viewPredicate(view, dates, Boolean(f.q))]),
  ) as Record<string, SQL | undefined>; // cast: built from the given view list
}
// One JSON object of per-view counts, evaluated once as an uncorrelated subquery.
function countsJson(f: Filters, dates: Dates, views: readonly string[]) {
  const predicates = viewPredicates(f, dates, views);
  const pairs = views.map(
    (view) => sql`${view}::text, count(*) filter (where ${predicates[view]})::int`,
  );
  return sql`(select json_build_object(${sql.join(pairs, sql`, `)}) from notes where ${base(f) ?? sql`true`})`;
}
export async function selectNotes(
  database: Database,
  f: Filters,
  dates: Dates,
  views: readonly string[],
  spec: SortSpec,
  limit: number,
  last: (string | number)[] | null,
) {
  return database
    .select({ ...columns, counts: countsJson(f, dates, views), ...cursorColumns(spec) })
    .from(notes)
    .where(and(base(f), viewPredicate(f.view, dates, Boolean(f.q)), cursorPredicate(spec, last)))
    .orderBy(...orderBy(spec))
    .limit(limit);
}
export async function countNotes(
  database: Database,
  f: Filters,
  dates: Dates,
  views: readonly string[],
) {
  const [row] = await database
    .select(filteredCounts(viewPredicates(f, dates, views)))
    .from(notes)
    .where(base(f));
  return row ?? {};
}
export async function selectNote(database: Database, noteId: string) {
  const [row] = await database.select(columns).from(notes).where(eq(notes.id, noteId));
  return row;
}
// NOTES-B07: open tasks first by due date then title, then completed by completion desc.
export function selectNoteTasks(database: Database, noteId: string) {
  return database
    .select({
      id: sql<string>`t.id`,
      revision: sql<number>`t.revision`,
      title: sql<string>`t.title`,
      status: sql<string>`t.status`,
      priority: sql<string | null>`t.priority`,
      dueDate: sql<string | null>`t.due_date::text`,
      completedAt: sql<string | null>`to_json(t.completed_at)#>>'{}'`,
      ownerName: sql<
        string | null
      >`(select coalesce(p.display_name, p.full_name) from people p where p.id = t.owner_id)`,
    })
    .from(sql`tasks t`)
    .where(sql`t.source_note_id = ${noteId}::uuid and t.deleted_at is null`)
    .orderBy(
      sql`(t.status = 'completed'), t.completed_at desc nulls last, t.due_date asc nulls last, lower(t.title), t.id`,
    );
}
export function selectTags(database: Database) {
  return database
    .select({ tag: sql<string>`tag`, count: sql<number>`count(*)::int` })
    .from(sql`notes, unnest(tags) tag`)
    .where(sql`deleted_at is null`)
    .groupBy(sql`tag`)
    .orderBy(sql`count(*) desc, lower(tag), tag collate "C"`);
}
export async function insertNote(database: Database, input: typeof notes.$inferInsert) {
  const [row] = await database.insert(notes).values(input).returning();
  if (!row) throw new Error('Note insert failed');
  return row;
}
export function updateNote(
  database: Database,
  noteId: string,
  revision: number,
  patch: EntityPatch<typeof notes.$inferInsert>,
  actorId: string,
) {
  return updateEntity<typeof notes.$inferSelect>(database, notes, noteId, revision, patch, actorId);
}
export function restoreNote(database: Database, noteId: string, opId: string, actorId: string) {
  return restoreEntity<typeof notes.$inferSelect>(database, notes, noteId, opId, actorId);
}
export async function activeParticipantIds(database: Database, noteId: string) {
  const rows = await database
    .select({ personId: notePeople.personId })
    .from(notePeople)
    .where(and(eq(notePeople.noteId, noteId), isNull(notePeople.deletedAt)));
  return rows.map((row) => row.personId);
}
export async function insertParticipants(
  database: Database,
  noteId: string,
  personIds: string[],
  actorId: string,
) {
  if (!personIds.length) return;
  await database
    .insert(notePeople)
    .values(personIds.map((personId) => ({ id: id(), noteId, personId, createdBy: actorId })));
}
export async function removeParticipants(
  database: Database,
  noteId: string,
  personIds: string[],
  opId: string,
) {
  if (!personIds.length) return;
  await database
    .update(notePeople)
    .set({ deletedAt: new Date(), deletedOpId: opId })
    .where(
      and(
        eq(notePeople.noteId, noteId),
        inArray(notePeople.personId, personIds),
        isNull(notePeople.deletedAt),
      ),
    );
}
// NOTES-B14: count and the five newest recent notes in one statement.
export async function selectRecent(database: Database, from: string, to: string) {
  const recent = and(
    isNull(notes.deletedAt),
    isNull(notes.archivedAt),
    sql`${notes.noteDate} between ${from} and ${to}`,
  );
  const [row] = await database
    .select({
      count: sql<number>`count(*) filter (where ${recent})::int`,
      items: sql`coalesce((select json_agg(item) from (select id, title from notes where ${recent} order by note_date desc, created_at desc, id desc limit 5) item), '[]'::json)`,
    })
    .from(notes);
  return row ?? { count: 0, items: [] };
}
