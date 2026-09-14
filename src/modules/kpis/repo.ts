import 'server-only';
import { and, eq, isNull, sql, getTableColumns } from 'drizzle-orm';
import type { Database } from '@/core/db/client';
import { normalize } from '@/core/search/normalize';
import { updateEntity, restoreEntity, type EntityPatch } from '@/core/db/entity';
import { kpis, kpiReadings, kpiTargets, objectives } from './schema/db';
type ListQuery = {
  view: string;
  q: string;
  objectiveId: string;
  category: string;
  ownerId: string;
};
type Reading = { date: string; value: number };
type Target = { year: number; period: number; value: number };
// The window a list or a record is read through: the day the workspace is on and the earliest year
// worth fetching a target for. Every KPI is on its own cadence, so the period boundaries themselves
// are derived per row from `kpis.frequency` rather than passed in — one statement cannot carry one
// set of dates for rows that are reported monthly, quarterly and annually.
export type Window = { today: string; fromYear: number };
// A scorecard is a bounded instrument: objectives, a category per KPI, a handful of readings each.
// The list reads its candidates in one statement and ranks them in the service, because a KPI's
// status is a function of the workspace's thresholds and today's date rather than of a column
// (KPIS-B10, KPIS-B11). This is the ceiling on how many KPIs one page of that ranking considers.
export const CANDIDATE_LIMIT = 500;
const live = sql`r.deleted_at is null`;
// The calendar unit and the step of one reporting period, read off the row's own frequency.
const periodUnit = sql`case kpis.frequency when 'monthly' then 'month' when 'quarterly' then 'quarter' else 'year' end`;
const periodStep = sql`case kpis.frequency when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' else interval '1 year' end`;
const periodStart = (today: string) => sql`date_trunc(${periodUnit}, ${today}::date)`;
const upTo = (today: string) =>
  sql`r.kpi_id = kpis.id and ${live} and r.reading_date <= ${today}::date`;
function columns(window: Window) {
  const today = window.today;
  return {
    ...getTableColumns(kpis),
    objectiveName: sql<
      string | null
    >`(select o.name from objectives o where o.id = kpis.objective_id)`,
    objectiveDeleted: sql<boolean>`coalesce((select o.deleted_at is not null from objectives o where o.id = kpis.objective_id), false)`,
    ownerName: sql<string | null>`(select p.full_name from people p where p.id = kpis.owner_id)`,
    current: sql<Reading | null>`(select json_build_object('date', r.reading_date, 'value', r.value::float8)
      from kpi_readings r where ${upTo(today)} order by r.reading_date desc, r.id desc limit 1)`,
    previous: sql<number | null>`(select r.value::float8 from kpi_readings r where ${upTo(today)}
      order by r.reading_date desc, r.id desc offset 1 limit 1)`,
    // KPIS-B05: the last eight readings up to today, oldest first so the spark reads left to right.
    sparkline: sql<
      Reading[]
    >`coalesce((select json_agg(json_build_object('date', s.reading_date, 'value', s.value::float8)
      order by s.reading_date) from (select r.reading_date, r.value from kpi_readings r
      where ${upTo(today)} order by r.reading_date desc limit 8) s), '[]'::json)`,
    // Only the quarters the status and the previous-quarter comparison can reach, newest last.
    targets: sql<
      Target[]
    >`coalesce((select json_agg(json_build_object('year', s.year, 'period', s.period, 'value', s.target_value::float8)
      order by s.year, s.period) from (select t.year, t.period, t.target_value from kpi_targets t
      where t.kpi_id = kpis.id and t.deleted_at is null and t.year >= ${window.fromYear}
      order by t.year, t.period limit 40) s), '[]'::json)`,
    previousPeriodValue: sql<
      number | null
    >`(select r.value::float8 from kpi_readings r where r.kpi_id = kpis.id and ${live}
      and r.reading_date >= (${periodStart(today)} - ${periodStep})::date
      and r.reading_date < ${periodStart(today)}::date
      order by r.reading_date desc, r.id desc limit 1)`,
  };
}
function base(query: ListQuery) {
  const pattern = '%' + normalize(query.q).replace(/[\\%_]/g, '\\$&') + '%';
  return and(
    query.q ? sql`${kpis.searchText} like ${pattern}` : undefined,
    query.objectiveId === 'none'
      ? isNull(kpis.objectiveId)
      : query.objectiveId
        ? sql`${kpis.objectiveId} = ${query.objectiveId}::uuid`
        : undefined,
    query.category ? eq(kpis.category, query.category) : undefined,
    query.ownerId === 'none'
      ? isNull(kpis.ownerId)
      : query.ownerId
        ? sql`${kpis.ownerId} = ${query.ownerId}::uuid`
        : undefined,
  );
}
// Deleted rows come back with the rest: the service partitions them into the trash view and counts
// every view from the one result, which is what keeps the list to two statements (KPIS-B07).
export function selectKpis(database: Database, query: ListQuery, window: Window) {
  return database
    .select(columns(window))
    .from(kpis)
    .where(base(query))
    .orderBy(sql`lower(${kpis.name})`, kpis.id)
    .limit(CANDIDATE_LIMIT);
}
export async function selectKpi(database: Database, kpiId: string, window: Window) {
  const [row] = await database.select(columns(window)).from(kpis).where(eq(kpis.id, kpiId));
  return row;
}
export async function selectFacets(database: Database) {
  const categories = await database
    .select({ value: kpis.category })
    .from(kpis)
    .where(and(isNull(kpis.deletedAt), sql`${kpis.category} <> ''`))
    .groupBy(kpis.category)
    .orderBy(kpis.category);
  const named = await database
    .select({ id: objectives.id, name: objectives.name })
    .from(objectives)
    .where(isNull(objectives.deletedAt))
    .orderBy(objectives.sortOrder, objectives.id);
  return { categories: categories.map((row) => row.value), objectives: named };
}
export function selectReadings(database: Database, kpiId: string) {
  return database
    .select({
      id: kpiReadings.id,
      revision: kpiReadings.revision,
      readingDate: kpiReadings.readingDate,
      value: kpiReadings.value,
      note: kpiReadings.note,
      createdAt: kpiReadings.createdAt,
    })
    .from(kpiReadings)
    .where(and(eq(kpiReadings.kpiId, kpiId), isNull(kpiReadings.deletedAt)))
    .orderBy(sql`${kpiReadings.readingDate} desc`, sql`${kpiReadings.id} desc`)
    .limit(200);
}
export function selectTargets(database: Database, kpiId: string) {
  return database
    .select({
      id: kpiTargets.id,
      year: kpiTargets.year,
      period: kpiTargets.period,
      targetValue: kpiTargets.targetValue,
    })
    .from(kpiTargets)
    .where(and(eq(kpiTargets.kpiId, kpiId), isNull(kpiTargets.deletedAt)))
    .orderBy(kpiTargets.year, kpiTargets.period);
}
export async function lockKpi(database: Database, kpiId: string) {
  // docs/04 § Concurrency: a child write holds the parent row so derived values stay consistent.
  await database.execute(sql`select id from kpis where id = ${kpiId}::uuid for update`);
}
export async function insertKpi(database: Database, input: typeof kpis.$inferInsert) {
  const [row] = await database
    .insert(kpis)
    .values({ ...input, sortOrder: sql`(select coalesce(max(sort_order), -1) + 1 from kpis)` })
    .returning();
  if (!row) throw new Error('KPI insert failed');
  return row;
}
export function updateKpi(
  database: Database,
  kpiId: string,
  revision: number,
  patch: EntityPatch<typeof kpis.$inferInsert>,
  actor: string,
) {
  return updateEntity<typeof kpis.$inferSelect>(database, kpis, kpiId, revision, patch, actor);
}
export function restoreKpi(database: Database, kpiId: string, opId: string, actor: string) {
  return restoreEntity<typeof kpis.$inferSelect>(database, kpis, kpiId, opId, actor);
}
// KPIS-I03: the children are hidden under the parent's operation id, so a restore of that operation
// brings back exactly the rows it hid and leaves rows deleted earlier alone.
export async function hideChildren(database: Database, kpiId: string, opId: string) {
  const stamp = { deletedAt: new Date(), deletedOpId: opId };
  await database
    .update(kpiReadings)
    .set(stamp)
    .where(and(eq(kpiReadings.kpiId, kpiId), isNull(kpiReadings.deletedAt)));
  await database
    .update(kpiTargets)
    .set(stamp)
    .where(and(eq(kpiTargets.kpiId, kpiId), isNull(kpiTargets.deletedAt)));
}
export async function revealChildren(database: Database, kpiId: string, opId: string) {
  const stamp = { deletedAt: null, deletedOpId: null };
  await database
    .update(kpiReadings)
    .set(stamp)
    .where(and(eq(kpiReadings.kpiId, kpiId), eq(kpiReadings.deletedOpId, opId)));
  await database
    .update(kpiTargets)
    .set(stamp)
    .where(and(eq(kpiTargets.kpiId, kpiId), eq(kpiTargets.deletedOpId, opId)));
}
export async function selectReadingOn(database: Database, kpiId: string, day: string) {
  const [row] = await database
    .select({ id: kpiReadings.id, revision: kpiReadings.revision, value: kpiReadings.value })
    .from(kpiReadings)
    .where(
      and(
        eq(kpiReadings.kpiId, kpiId),
        eq(kpiReadings.readingDate, day),
        isNull(kpiReadings.deletedAt),
      ),
    );
  return row;
}
export async function selectReading(database: Database, readingId: string) {
  const [row] = await database
    .select({
      id: kpiReadings.id,
      kpiId: kpiReadings.kpiId,
      revision: kpiReadings.revision,
      readingDate: kpiReadings.readingDate,
      value: kpiReadings.value,
      note: kpiReadings.note,
      createdAt: kpiReadings.createdAt,
      deletedAt: kpiReadings.deletedAt,
    })
    .from(kpiReadings)
    .where(eq(kpiReadings.id, readingId));
  return row;
}
export async function insertReading(database: Database, input: typeof kpiReadings.$inferInsert) {
  const [row] = await database.insert(kpiReadings).values(input).returning();
  if (!row) throw new Error('Reading insert failed');
  return row;
}
export function updateReading(
  database: Database,
  readingId: string,
  revision: number,
  patch: EntityPatch<typeof kpiReadings.$inferInsert>,
  actor: string,
) {
  return updateEntity<typeof kpiReadings.$inferSelect>(
    database,
    kpiReadings,
    readingId,
    revision,
    patch,
    actor,
  );
}
export async function upsertTargets(
  database: Database,
  kpiId: string,
  actor: string,
  items: { id: string; year: number; period: number; targetValue: number }[],
) {
  await database
    .insert(kpiTargets)
    .values(items.map((item) => ({ ...item, kpiId, createdBy: actor })))
    .onConflictDoUpdate({
      target: [kpiTargets.kpiId, kpiTargets.year, kpiTargets.period],
      targetWhere: isNull(kpiTargets.deletedAt),
      set: { targetValue: sql`excluded.target_value`, updatedAt: new Date() },
    });
}
export async function deleteTarget(database: Database, targetId: string, opId: string) {
  const [row] = await database
    .update(kpiTargets)
    .set({ deletedAt: new Date(), deletedOpId: opId })
    .where(and(eq(kpiTargets.id, targetId), isNull(kpiTargets.deletedAt)))
    .returning({ id: kpiTargets.id, kpiId: kpiTargets.kpiId });
  return row;
}
const objectiveColumns = {
  ...getTableColumns(objectives),
  kpiCount: sql<number>`(select count(*)::int from kpis k where k.objective_id = objectives.id and k.deleted_at is null)`,
};
export function selectObjectives(database: Database, includeDeleted: boolean) {
  return database
    .select(objectiveColumns)
    .from(objectives)
    .where(includeDeleted ? undefined : isNull(objectives.deletedAt))
    .orderBy(objectives.sortOrder, objectives.id);
}
export async function selectObjective(database: Database, objectiveId: string) {
  const [row] = await database
    .select(objectiveColumns)
    .from(objectives)
    .where(eq(objectives.id, objectiveId));
  return row;
}
export async function insertObjective(database: Database, input: typeof objectives.$inferInsert) {
  const [row] = await database
    .insert(objectives)
    .values({
      ...input,
      sortOrder: sql`(select coalesce(max(sort_order), -1) + 1 from objectives)`,
    })
    .returning();
  if (!row) throw new Error('Objective insert failed');
  return row;
}
export function updateObjective(
  database: Database,
  objectiveId: string,
  revision: number,
  patch: EntityPatch<typeof objectives.$inferInsert>,
  actor: string,
) {
  return updateEntity<typeof objectives.$inferSelect>(
    database,
    objectives,
    objectiveId,
    revision,
    patch,
    actor,
  );
}
export function restoreObjective(
  database: Database,
  objectiveId: string,
  opId: string,
  actor: string,
) {
  return restoreEntity<typeof objectives.$inferSelect>(
    database,
    objectives,
    objectiveId,
    opId,
    actor,
  );
}
export async function lockObjectives(database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(7312)`);
}
