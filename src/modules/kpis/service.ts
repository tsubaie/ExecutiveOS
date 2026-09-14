/** KPIS-I01–I04: one reading per date, one target per quarter, children hidden with their KPI's
 * operation id, and thresholds validated before any status is read from them. */
import 'server-only';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { writeAudit, toJson } from '@/core/db/audit-repo';
import { getSetting } from '@/core/db/settings-repo';
import { dayAt } from '@/core/time/tasks';
import {
  quarterOf,
  quarterLabel,
  quarterIndex,
  quarterRange,
  previousQuarter,
  type Quarter,
} from '@/core/time/kpis';
import type { StatusThresholds } from '@/core/config/settings';
import { requireRevision, applyUpdate, restoreByOp } from '@/core/entity/service';
import {
  filtersHash,
  compareTuples,
  encodeTupleCursor,
  decodeTupleCursor,
  type Tuple,
} from '@/core/db/keyset';
import { AppError } from '@/core/http/errors';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import {
  Kpi,
  KpiDetail,
  KpiStatus,
  Objective,
  attentionStatuses,
  severityRank,
  deriveMeta,
  type KpiCreate,
  type KpiPatch,
  type KpiListQuery,
  type ObjectiveCreate,
  type ObjectivePatch,
  type ReadingCreate,
  type ReadingPatch,
  type TargetsPut,
} from './schema/validation';
import * as repo from './repo';
type Row = Awaited<ReturnType<typeof repo.selectKpi>>;
type Scope = { today: string; quarter: Quarter; thresholds: StatusThresholds };
// KPIS-B02: the quarter arithmetic happens once per request and travels to the repository as plain
// values, so no calendar rule is written twice.
function windowOf(at: Scope): repo.Window {
  const before = previousQuarter(at.quarter);
  const { from, to } = quarterRange(before);
  return { today: at.today, earliest: quarterIndex(before), previousFrom: from, previousTo: to };
}
type Keyed = { item: Kpi; key: Tuple };
async function scope(ctx: Context): Promise<Scope> {
  const today = dayAt(await getSetting(ctx.db, 'workspace.timezone'));
  return {
    today,
    quarter: quarterOf(today),
    thresholds: await getSetting(ctx.db, 'kpis.status_thresholds'),
  };
}
const toKpi = (row: NonNullable<Row>, at: Scope) =>
  Kpi.parse({ ...row, meta: deriveMeta(row, at) });
// KPIS-B07: the sort keys are the cursor tuple. Severity first by default, because the page exists
// to surface what is not on track; name breaks every tie so the order is total and stable.
function keyOf(item: Kpi, sort: string): Tuple {
  const name = item.name.toLocaleLowerCase();
  if (sort === 'name') return [name, item.id];
  if (sort === 'change') {
    const change = item.meta.percentChange;
    return [change === null ? 1 : 0, change === null ? 0 : -change, name, item.id];
  }
  return [severityRank[item.meta.status], name, item.id];
}
function inView(item: Kpi, view: string) {
  if (view === 'trash') return Boolean(item.deletedAt);
  if (item.deletedAt) return false;
  if (view === 'all') return true;
  if (view === 'attention') return attentionStatuses.includes(item.meta.status);
  return item.meta.status === view;
}
const views = ['all', 'attention', ...KpiStatus.options, 'trash'];
export async function listKpis(ctx: Context, query: KpiListQuery) {
  const at = await scope(ctx);
  const rows = await repo.selectKpis(ctx.db, query, windowOf(at));
  const all = rows.map((row) => toKpi(row, at));
  const { cursor, ...filters } = query;
  const hash = filtersHash({ ...filters, date: at.today });
  const ranked: Keyed[] = all
    .filter((item) => inView(item, query.view))
    .map((item) => ({ item, key: keyOf(item, query.sort) }))
    .sort((left, right) => compareTuples(left.key, right.key));
  const after = decodeTupleCursor(cursor, query.sort, hash);
  const remaining = after ? ranked.filter((row) => compareTuples(row.key, after) > 0) : ranked;
  const page = remaining.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => row.item),
    meta: {
      counts: Object.fromEntries(
        views.map((view) => [view, all.filter((item) => inView(item, view)).length]),
      ),
      nextCursor:
        remaining.length > query.limit && last
          ? encodeTupleCursor(query.sort, hash, last.key)
          : null,
    },
  };
}
// The values the rail's facets offer, read once rather than inferred from the page on screen.
export async function kpiFacets(ctx: Context) {
  return repo.selectFacets(ctx.db);
}
const kpiOps = {
  entityType: 'kpi',
  get: getKpi,
  update: (
    ctx: Context,
    entityId: string,
    revision: number,
    fields: Parameters<typeof repo.updateKpi>[3],
  ) => repo.updateKpi(ctx.db, entityId, revision, fields, ctx.user.id),
  restore: (ctx: Context, entityId: string, opId: string) =>
    repo.restoreKpi(ctx.db, entityId, opId, ctx.user.id),
};
async function requireRow(ctx: Context, kpiId: string, includeDeleted: boolean) {
  const at = await scope(ctx);
  const row = await repo.selectKpi(ctx.db, kpiId, windowOf(at));
  if (!row || (row.deletedAt && !includeDeleted)) throw new AppError('not_found');
  return { row, at };
}
export async function getKpi(ctx: Context, kpiId: string, includeDeleted = false) {
  const { row, at } = await requireRow(ctx, kpiId, includeDeleted);
  return toKpi(row, at);
}
// KPIS-B08: the record carries its own readings and targets, plus the quarter it is measured
// against and the one before it, so the detail never re-queries the list.
export async function getKpiDetail(ctx: Context, kpiId: string, includeDeleted = false) {
  const { row, at } = await requireRow(ctx, kpiId, includeDeleted);
  const readings = await repo.selectReadings(ctx.db, kpiId);
  const targets = await repo.selectTargets(ctx.db, kpiId);
  const before = previousQuarter(at.quarter);
  const match = row.targets.find((t) => t.year === before.year && t.quarter === before.quarter);
  return KpiDetail.parse({
    ...row,
    meta: deriveMeta(row, at),
    readings: readings.map((reading) => ({ ...reading, future: reading.readingDate > at.today })),
    targets,
    previousQuarter: {
      label: quarterLabel(before),
      value: row.previousQuarterValue,
      target: match?.value ?? null,
    },
  });
}
export async function createKpi(ctx: Context, input: KpiCreate) {
  await requireObjective(ctx, input.objectiveId);
  const row = await repo.insertKpi(ctx.db, {
    ...input,
    id: id(),
    createdBy: ctx.user.id,
    updatedBy: ctx.user.id,
  });
  await writeAudit(ctx.db, ctx.user.id, 'create', 'kpi', row.id, toJson(input));
  return getKpiDetail(ctx, row.id);
}
export async function patchKpi(ctx: Context, kpiId: string, input: KpiPatch) {
  if (input.objectiveId !== undefined) await requireObjective(ctx, input.objectiveId);
  const row = await requireRevision(ctx, kpiOps, kpiId, input.revision);
  const { revision, ...fields } = input;
  void revision;
  await applyUpdate(ctx, kpiOps, row, fields);
  return getKpiDetail(ctx, kpiId);
}
export async function removeKpi(ctx: Context, kpiId: string, revision: number) {
  const row = await requireRevision(ctx, kpiOps, kpiId, revision);
  const opId = id();
  await applyUpdate(
    ctx,
    kpiOps,
    row,
    { deletedAt: new Date(), deletedOpId: opId },
    { action: 'delete', opId, diff: {} },
  );
  await repo.hideChildren(ctx.db, kpiId, opId);
  return { opId };
}
export async function restoreKpi(ctx: Context, kpiId: string, opId: string) {
  await getKpi(ctx, kpiId, true);
  await restoreByOp(ctx, kpiOps, kpiId, opId);
  await repo.revealChildren(ctx.db, kpiId, opId);
  return getKpiDetail(ctx, kpiId);
}
// KPIS-B06: a deleted objective keeps its KPIs; only a live objective may be assigned.
async function requireObjective(ctx: Context, objectiveId: string | null) {
  if (!objectiveId) return;
  const row = await repo.selectObjective(ctx.db, objectiveId);
  if (!row || row.deletedAt)
    throw new AppError('rule_violation', {
      rule: 'KPIS-B06',
      fieldErrors: { objectiveId: ['unknown'] },
    });
}
const objectiveOps = {
  entityType: 'objective',
  get: getObjective,
  update: (
    ctx: Context,
    entityId: string,
    revision: number,
    fields: Parameters<typeof repo.updateObjective>[3],
  ) => repo.updateObjective(ctx.db, entityId, revision, fields, ctx.user.id),
  restore: (ctx: Context, entityId: string, opId: string) =>
    repo.restoreObjective(ctx.db, entityId, opId, ctx.user.id),
};
export async function listObjectives(ctx: Context, includeDeleted = false) {
  const rows = await repo.selectObjectives(ctx.db, includeDeleted);
  return { data: rows.map((row) => Objective.parse(row)) };
}
export async function getObjective(ctx: Context, objectiveId: string, includeDeleted = false) {
  const row = await repo.selectObjective(ctx.db, objectiveId);
  if (!row || (row.deletedAt && !includeDeleted)) throw new AppError('not_found');
  return Objective.parse(row);
}
export async function createObjective(ctx: Context, input: ObjectiveCreate) {
  const row = await repo.insertObjective(ctx.db, {
    ...input,
    id: id(),
    createdBy: ctx.user.id,
    updatedBy: ctx.user.id,
  });
  await writeAudit(ctx.db, ctx.user.id, 'create', 'objective', row.id, toJson(input));
  return getObjective(ctx, row.id);
}
export async function patchObjective(ctx: Context, objectiveId: string, input: ObjectivePatch) {
  const row = await requireRevision(ctx, objectiveOps, objectiveId, input.revision);
  const { revision, ...fields } = input;
  void revision;
  await applyUpdate(ctx, objectiveOps, row, fields);
  return getObjective(ctx, objectiveId);
}
export async function removeObjective(ctx: Context, objectiveId: string, revision: number) {
  const row = await requireRevision(ctx, objectiveOps, objectiveId, revision);
  const opId = id();
  await applyUpdate(
    ctx,
    objectiveOps,
    row,
    { deletedAt: new Date(), deletedOpId: opId },
    { action: 'delete', opId, diff: {} },
  );
  return { opId };
}
export async function restoreObjective(ctx: Context, objectiveId: string, opId: string) {
  await getObjective(ctx, objectiveId, true);
  await restoreByOp(ctx, objectiveOps, objectiveId, opId);
  return getObjective(ctx, objectiveId);
}
export async function reorderObjectives(ctx: Context, items: { id: string; revision: number }[]) {
  await repo.lockObjectives(ctx.db);
  for (const [sortOrder, item] of items.entries()) {
    const row = await requireRevision(ctx, objectiveOps, item.id, item.revision);
    await applyUpdate(ctx, objectiveOps, row, { sortOrder }, { action: 'reorder' });
  }
  return { data: { updatedIds: items.map((item) => item.id) } };
}
export async function listReadings(ctx: Context, kpiId: string) {
  const { at } = await requireRow(ctx, kpiId, true);
  const rows = await repo.selectReadings(ctx.db, kpiId);
  return { data: rows.map((row) => ({ ...row, future: row.readingDate > at.today })) };
}
// KPIS-B09: a duplicate date is a 409 that names the row to overwrite, so the client can offer the
// overwrite rather than silently replacing a reading somebody else entered.
export async function addReading(ctx: Context, kpiId: string, input: ReadingCreate) {
  await getKpi(ctx, kpiId);
  await repo.lockKpi(ctx.db, kpiId);
  const existing = await repo.selectReadingOn(ctx.db, kpiId, input.readingDate);
  if (existing) throw new AppError('conflict', { reason: 'unique', existing: { id: existing.id } });
  const row = await repo.insertReading(ctx.db, {
    ...input,
    id: id(),
    kpiId,
    createdBy: ctx.user.id,
    updatedBy: ctx.user.id,
  });
  await writeAudit(ctx.db, ctx.user.id, 'create', 'kpi_reading', row.id, toJson(input));
  return getKpiDetail(ctx, kpiId);
}
export async function overwriteReading(
  ctx: Context,
  kpiId: string,
  day: string,
  input: { value: number; note: string },
) {
  await getKpi(ctx, kpiId);
  await repo.lockKpi(ctx.db, kpiId);
  const existing = await repo.selectReadingOn(ctx.db, kpiId, day);
  if (!existing)
    return addReading(ctx, kpiId, { readingDate: day, value: input.value, note: input.note });
  const row = await repo.updateReading(ctx.db, existing.id, existing.revision, input, ctx.user.id);
  if (!row) throw new AppError('conflict', { reason: 'state' });
  await writeAudit(ctx.db, ctx.user.id, 'update', 'kpi_reading', existing.id, toJson(input));
  return getKpiDetail(ctx, kpiId);
}
async function requireReading(ctx: Context, kpiId: string, readingId: string) {
  const row = await repo.selectReading(ctx.db, readingId);
  if (!row || row.deletedAt || row.kpiId !== kpiId) throw new AppError('not_found');
  return row;
}
export async function patchReading(
  ctx: Context,
  kpiId: string,
  readingId: string,
  input: ReadingPatch,
) {
  await getKpi(ctx, kpiId);
  const current = await requireReading(ctx, kpiId, readingId);
  const { revision, ...fields } = input;
  if (current.revision !== revision)
    throw new AppError('conflict', { reason: 'revision', current: toJson(current) });
  const row = await repo.updateReading(ctx.db, readingId, revision, fields, ctx.user.id);
  if (!row) throw new AppError('conflict', { reason: 'revision' });
  await writeAudit(ctx.db, ctx.user.id, 'update', 'kpi_reading', readingId, toJson(fields));
  return getKpiDetail(ctx, kpiId);
}
export async function removeReading(ctx: Context, kpiId: string, readingId: string) {
  await getKpi(ctx, kpiId);
  const current = await requireReading(ctx, kpiId, readingId);
  const opId = id();
  const row = await repo.updateReading(
    ctx.db,
    readingId,
    current.revision,
    { deletedAt: new Date(), deletedOpId: opId },
    ctx.user.id,
  );
  if (!row) throw new AppError('conflict', { reason: 'revision' });
  await writeAudit(ctx.db, ctx.user.id, 'delete', 'kpi_reading', readingId, {}, opId);
  return { opId };
}
export async function listTargets(ctx: Context, kpiId: string) {
  await getKpi(ctx, kpiId, true);
  return { data: await repo.selectTargets(ctx.db, kpiId) };
}
export async function putTargets(ctx: Context, kpiId: string, input: TargetsPut) {
  await getKpi(ctx, kpiId);
  await repo.lockKpi(ctx.db, kpiId);
  await repo.upsertTargets(
    ctx.db,
    kpiId,
    ctx.user.id,
    input.items.map((item) => ({ ...item, id: id() })),
  );
  await writeAudit(ctx.db, ctx.user.id, 'update', 'kpi_targets', kpiId, toJson(input));
  return getKpiDetail(ctx, kpiId);
}
export async function removeTarget(ctx: Context, kpiId: string, targetId: string) {
  await getKpi(ctx, kpiId);
  const opId = id();
  const row = await repo.deleteTarget(ctx.db, targetId, opId);
  if (!row || row.kpiId !== kpiId) throw new AppError('not_found');
  await writeAudit(ctx.db, ctx.user.id, 'delete', 'kpi_target', targetId, {}, opId);
  return { opId };
}
// HOME-B01 § Attention KPIs: the page consumes this through the module's server manifest.
export async function homeSummary(ctx: Context, day: string): Promise<HomeSection[]> {
  const thresholds = await getSetting(ctx.db, 'kpis.status_thresholds');
  const at: Scope = { today: day, quarter: quarterOf(day), thresholds };
  const rows = await repo.selectKpis(
    ctx.db,
    { view: 'attention', q: '', objectiveId: '', category: '', team: '' },
    windowOf(at),
  );
  const attention = rows
    .map((row) => toKpi(row, at))
    .filter((item) => !item.deletedAt && attentionStatuses.includes(item.meta.status))
    .sort((left, right) => compareTuples(keyOf(left, 'default'), keyOf(right, 'default')));
  return [
    {
      key: 'kpis',
      enabled: true,
      count: attention.length,
      href: routes.kpis({ view: 'attention' }),
      stale: attention.filter((item) => item.meta.status === 'stale').length,
      items: attention.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.name,
        href: routes.kpis({ view: 'all', id: item.id }),
        committee: item.objectiveName,
        date: item.meta.currentDate,
      })),
    },
  ];
}
