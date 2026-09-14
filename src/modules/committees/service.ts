/** COMM-I01–I03: unique active names, revision/audit-safe mutations, preserve linked work. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { writeAudit, toJson } from '@/core/db/audit-repo';
import { getSetting } from '@/core/db/settings-repo';
import { dayAt } from '@/core/time/tasks';
import { requireRevision, applyUpdate, restoreByOp } from '@/core/entity/service';
import { filtersHash, decodeCursor, encodeCursor } from '@/core/db/keyset';
import { AppError } from '@/core/http/errors';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import { Committee, CommitteeChoices, type CommitteeCreate, type CommitteePatch, type CommitteeListQuery, Reorder } from './schema/validation';
import * as repo from './repo';
const today = async (ctx: Context) => dayAt(await getSetting(ctx.db, 'workspace.timezone'));
const ops = { entityType: 'committee', get: getCommittee,
  update: (ctx: Context, entityId: string, revision: number, fields: Parameters<typeof repo.updateCommittee>[3]) => repo.updateCommittee(ctx.db, entityId, revision, fields, ctx.user.id),
  restore: (ctx: Context, entityId: string, opId: string) => repo.restoreCommittee(ctx.db, entityId, opId, ctx.user.id),
};
export async function listCommittees(ctx: Context, query: CommitteeListQuery) {
  const date = await today(ctx);
  const spec = repo.committeeSort(query.sort, date);
  const { cursor, ...filters } = query;
  const hash = filtersHash({ ...filters, date });
  const rows = await repo.selectCommittees(ctx.db, query, date, spec, decodeCursor(cursor, spec, hash));
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return { data: page.map((row) => Committee.parse(row)), meta: {
    counts: await repo.committeeCounts(ctx.db, query, date), taskStats: await repo.taskStats(ctx.db, query, date),
    nextCursor: rows.length > query.limit && last ? encodeCursor(spec, hash, last) : null,
  } };
}
export async function getCommittee(ctx: Context, committeeId: string, includeDeleted = false) {
  const row = await repo.selectCommittee(ctx.db, committeeId, await today(ctx));
  if (!row || (row.deletedAt && !includeDeleted)) throw new AppError('not_found');
  return Committee.parse(row);
}
async function uniqueName(ctx: Context, name: string, except?: string) {
  await repo.lockCommittees(ctx.db);
  if (await repo.duplicateName(ctx.db, name, except)) throw new AppError('conflict', { reason: 'unique', fieldErrors: { name: ['COMM-I01'] } });
}
export async function createCommittee(ctx: Context, input: CommitteeCreate) {
  await uniqueName(ctx, input.name);
  const row = await repo.insertCommittee(ctx.db, { ...input, id: id(), createdBy: ctx.user.id, updatedBy: ctx.user.id });
  await writeAudit(ctx.db, ctx.user.id, 'create', 'committee', row.id, toJson(input));
  return getCommittee(ctx, row.id);
}
export async function patchCommittee(ctx: Context, committeeId: string, input: CommitteePatch) {
  if (input.name !== undefined) await uniqueName(ctx, input.name, committeeId);
  const row = await requireRevision(ctx, ops, committeeId, input.revision);
  const { revision, ...fields } = input;
  void revision;
  await applyUpdate(ctx, ops, row, fields, { action: fields.status ? fields.status === 'archived' ? 'archive' : 'unarchive' : 'update' });
  return getCommittee(ctx, committeeId);
}
export async function removeCommittee(ctx: Context, committeeId: string, revision: number) {
  const row = await requireRevision(ctx, ops, committeeId, revision);
  const opId = id();
  await applyUpdate(ctx, ops, row, { deletedAt: new Date(), deletedOpId: opId }, { action: 'delete', opId, diff: {} });
  return { opId };
}
export async function restoreCommittee(ctx: Context, committeeId: string, opId: string) {
  const row = await getCommittee(ctx, committeeId, true);
  await uniqueName(ctx, row.name, committeeId);
  await restoreByOp(ctx, ops, committeeId, opId);
  return getCommittee(ctx, committeeId);
}
export async function requireCommittee(ctx: Context, committeeId: string | null | undefined, current?: string | null) {
  if (!committeeId || committeeId === current) return;
  const row = await getCommittee(ctx, committeeId);
  if (row.status !== 'active') throw new AppError('rule_violation', { rule: 'COMM-B03', fieldErrors: { committeeId: ['archived'] } });
}
export async function committeeChoices(ctx: Context, current?: string) {
  return CommitteeChoices.parse({ data: await repo.selectChoices(ctx.db, current) });
}
export async function activity(ctx: Context, committeeId: string, cursor?: string) {
  await getCommittee(ctx, committeeId, true);
  const hash = filtersHash({ committeeId });
  const rows = await repo.selectActivity(ctx.db, committeeId, decodeCursor(cursor, repo.activitySort, hash));
  const page = rows.slice(0, 50);
  const last = page.at(-1);
  return { data: page, meta: { nextCursor: rows.length > 50 && last ? encodeCursor(repo.activitySort, hash, last) : null } };
}
export async function reorderCommittees(ctx: Context, input: z.infer<typeof Reorder>) {
  await repo.lockCommittees(ctx.db);
  for (const [sortOrder, item] of input.items.entries()) {
    const row = await requireRevision(ctx, ops, item.id, item.revision);
    await applyUpdate(ctx, ops, row, { sortOrder }, { action: 'reorder' });
  }
  return { data: { updatedIds: input.items.map((item) => item.id) } };
}
// HOME-B01: the home page consumes this through the module's server manifest (HOME-B03).
export async function homeSummary(ctx: Context): Promise<HomeSection[]> {
  const row = await repo.selectHomeSummary(ctx.db, await today(ctx));
  return [
    {
      key: 'committees',
      enabled: true,
      count: z.number().parse(row.count),
      href: routes.committees({ view: 'open' }),
      items: z
        .array(z.object({ id: z.uuid(), title: z.string(), count: z.number(), owner: z.string().nullable(), overdue: z.number(), done: z.number() }))
        .parse(row.items)
        .map((item) => ({ ...item, href: routes.committees({ view: 'all', id: item.id }) })),
    },
  ];
}
