/** TASKS-I01–I06, B01–B12: bounded hierarchy, completion, deletion provenance and fenced edits. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { toJson, writeAudit } from '@/core/db/audit-repo';
import { getSetting } from '@/core/db/settings-repo';
import { decodeCursor, encodeCursor, filtersHash } from '@/core/db/keyset';
import { applyUpdate, requireRevision, type EntityOps } from '@/core/entity/service';
import { AppError } from '@/core/http/errors';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import { dayAt, addDays, bandOf } from '@/core/time/tasks';
import { getPerson, personNameSql } from '@/modules/people';
import {
  TaskDetail,
  View,
  type TaskCreate,
  type TaskPatch,
  type TaskListQuery,
  type Group,
  type Reorder,
} from './schema/validation';
import * as repo from './repo';
type TaskRow = NonNullable<Awaited<ReturnType<typeof repo.updateTask>>>;
type Patch = Parameters<typeof repo.updateTask>[3];
const ops: EntityOps<TaskDetail, TaskRow, Patch> = {
  entityType: 'task',
  get: (ctx, taskId, includeDeleted) => getTask(ctx, taskId, includeDeleted),
  update: (ctx, taskId, revision, patch) =>
    repo.updateTask(ctx.db, taskId, revision, patch, ctx.user.id),
};
export async function listTasks(ctx: Context, query: TaskListQuery) {
  const timezone = await getSetting(ctx.db, 'workspace.timezone');
  const today = dayAt(timezone);
  const week = addDays(today, 7);
  const dates = [today, week, addDays(today, -90)];
  const { cursor, withTotal, limit, ...filters } = query;
  void withTotal;
  const hash = filtersHash(z.json().parse({ ...filters, today, timezone }));
  const spec = repo.sortSpec(query.sort, today, week);
  const rows = await repo.selectTasks(
    ctx.db,
    query,
    dates,
    spec,
    limit + 1,
    decodeCursor(cursor, spec, hash),
    personNameSql,
  );
  const counts = z
    .record(View, z.number())
    .parse(await repo.countTasks(ctx.db, query, View.options, dates));
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => TaskDetail.parse({ ...row, band: bandOf(row, today) })),
    meta: {
      counts,
      total: counts[query.view],
      today,
      timezone,
      defaultView: z.enum(['today', 'next']).parse(counts.today > 0 ? 'today' : 'next'),
      nextCursor: rows.length > limit && last ? encodeCursor(spec, hash, last) : null,
    },
  };
}
export async function getTask(ctx: Context, taskId: string, deleted = false) {
  const row = await repo.selectTask(ctx.db, taskId, personNameSql);
  if (!row || (!deleted && row.deletedAt)) throw new AppError('not_found', { entityType: 'task' });
  const children = await repo.selectChildren(ctx.db, taskId, personNameSql, true);
  return TaskDetail.parse({
    ...row,
    subtasks: deleted ? children : children.filter((child) => !child.deletedAt),
    deletedSubtasks: deleted ? [] : children.filter((child) => child.deletedAt),
  });
}
async function owner(ctx: Context, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const person = await getPerson(ctx, ownerId);
  if (!person.isAssignable) throw new AppError('rule_violation', { rule: 'TASKS-B10' });
}
async function current(ctx: Context, taskId: string, revision: number, deleted = false) {
  await repo.lockTasks(ctx.db);
  return requireRevision(ctx, ops, taskId, revision, deleted);
}
function update(
  ctx: Context,
  task: { id: string; revision: number },
  patch: Patch,
  action = 'update',
  opId?: string,
) {
  return applyUpdate(ctx, ops, task, patch, {
    action,
    opId: opId ?? null,
    ...(action === 'delete' || action === 'restore' ? { diff: {} } : {}),
  });
}
export async function createTask(ctx: Context, input: TaskCreate) {
  await repo.lockTasks(ctx.db);
  await owner(ctx, input.ownerId);
  if (input.parentId) {
    const parent = await getTask(ctx, input.parentId);
    if (parent.parentId) throw new AppError('rule_violation', { rule: 'TASKS-I01' });
  }
  const row = await repo.insertTask(ctx.db, {
    ...input,
    id: id(),
    sortOrder: await repo.nextOrder(ctx.db, input.parentId),
    createdBy: ctx.user.id,
    updatedBy: ctx.user.id,
  });
  await writeAudit(ctx.db, ctx.user.id, 'create', 'task', row.id, toJson(input));
  return getTask(ctx, row.id);
}
export async function patchTask(ctx: Context, taskId: string, input: TaskPatch) {
  if (input.status === 'completed') throw new AppError('rule_violation', { rule: 'TASKS-B02' });
  const task = await current(ctx, taskId, input.revision);
  await owner(ctx, input.ownerId);
  const { revision, ...fields } = input;
  void revision;
  await update(ctx, task, { ...fields, ...(fields.status ? { completedAt: null } : {}) });
  return getTask(ctx, taskId);
}
export async function completeTask(ctx: Context, taskId: string, revision: number, force = false) {
  const task = await current(ctx, taskId, revision);
  const open = task.subtasks.filter((child) => child.status !== 'completed');
  if (open.length && !force)
    throw new AppError('conflict', { reason: 'state', openSubtasks: open.length });
  const fields = { status: 'completed', completedAt: new Date() };
  for (const child of open) await update(ctx, child, fields, 'complete');
  await update(ctx, task, fields, 'complete');
  return getTask(ctx, taskId);
}
export async function reopenTask(ctx: Context, taskId: string, revision: number) {
  const task = await current(ctx, taskId, revision);
  await update(ctx, task, { status: 'next_action', completedAt: null }, 'reopen');
  return getTask(ctx, taskId);
}
export async function removeTask(ctx: Context, taskId: string, revision: number) {
  const task = await current(ctx, taskId, revision);
  const opId = id();
  const fields = { deletedAt: new Date(), deletedOpId: opId };
  for (const child of task.subtasks) await update(ctx, child, fields, 'delete', opId);
  await update(ctx, task, fields, 'delete', opId);
  return { opId };
}
export async function restoreTask(ctx: Context, taskId: string, opId: string) {
  await repo.lockTasks(ctx.db);
  const task = await getTask(ctx, taskId, true);
  if (!task.deletedAt || task.deletedOpId !== opId)
    throw new AppError('conflict', { reason: 'state' });
  if (task.parentId && (await getTask(ctx, task.parentId, true)).deletedAt)
    throw new AppError('rule_violation', { rule: 'TASKS-I04' });
  const fields = { deletedAt: null, deletedOpId: null };
  await update(
    ctx,
    task,
    { ...fields, sortOrder: await repo.nextOrder(ctx.db, task.parentId) },
    'restore',
    opId,
  );
  for (const child of task.subtasks.filter((child) => child.deletedOpId === opId))
    await update(
      ctx,
      child,
      { ...fields, sortOrder: await repo.nextOrder(ctx.db, child.parentId) },
      'restore',
      opId,
    );
  return getTask(ctx, taskId);
}
export async function moveTask(
  ctx: Context,
  taskId: string,
  revision: number,
  parentId: string | null,
) {
  const task = await current(ctx, taskId, revision);
  if (parentId) {
    const parent = await getTask(ctx, parentId);
    if (
      task.id === parentId ||
      parent.parentId ||
      (await repo.selectChildren(ctx.db, taskId, personNameSql, true)).length
    )
      throw new AppError('rule_violation', { rule: 'TASKS-I01' });
  }
  await update(ctx, task, { parentId, sortOrder: await repo.nextOrder(ctx.db, parentId) });
  return getTask(ctx, taskId);
}
export async function groupTasks(ctx: Context, input: z.infer<typeof Group>) {
  await repo.lockTasks(ctx.db);
  const children: TaskDetail[] = [];
  const invalid: string[] = [];
  for (const taskId of input.childIds) {
    const row = await repo.selectTask(ctx.db, taskId, personNameSql);
    if (
      !row ||
      row.deletedAt ||
      row.parentId ||
      (await repo.selectChildren(ctx.db, taskId, personNameSql, true)).length
    )
      invalid.push(taskId);
    else children.push(TaskDetail.parse(row));
  }
  if (invalid.length) throw new AppError('rule_violation', { rule: 'TASKS-B09', ids: invalid });
  const parent = await createTask(ctx, {
    title: input.title,
    description: null,
    status: 'inbox',
    priority: null,
    dueDate: null,
    ownerId: null,
    parentId: null,
  });
  for (const [sortOrder, child] of children.entries())
    await update(ctx, child, { parentId: parent.id, sortOrder });
  return getTask(ctx, parent.id);
}
export async function reorderTasks(ctx: Context, input: z.infer<typeof Reorder>) {
  await repo.lockTasks(ctx.db);
  const rows = input.parentId
    ? await repo.selectChildren(ctx.db, input.parentId, personNameSql)
    : [];
  if (
    !input.parentId ||
    rows.length !== input.orderedIds.length ||
    rows.some((row) => !input.orderedIds.includes(row.id))
  )
    throw new AppError('rule_violation', { rule: 'TASKS-I05' });
  if (rows.some((row) => input.revisions[row.id] !== row.revision))
    throw new AppError('conflict', { reason: 'revision' });
  await repo.reorderTasks(ctx.db, input.orderedIds, ctx.user.id);
  await writeAudit(ctx.db, ctx.user.id, 'reorder', 'task', input.parentId, {
    orderedIds: input.orderedIds,
  });
  return getTask(ctx, input.parentId);
}
export async function homeSummary(ctx: Context): Promise<HomeSection[]> {
  const timezone = await getSetting(ctx.db, 'workspace.timezone');
  const row = await repo.selectHomeSummary(ctx.db, dayAt(timezone));
  return ['overdue', 'today', 'waiting'].map((key) => ({
    key,
    enabled: true,
    count: z.number().parse(row[key + 'Count']),
    href: routes.tasks({ view: key }),
    items: z
      .array(z.object({ id: z.uuid(), title: z.string() }))
      .parse(row[key + 'Items'])
      .map((item) => ({ ...item, href: routes.tasks({ view: 'all', id: item.id }) })),
  }));
}
