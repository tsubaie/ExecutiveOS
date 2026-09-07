/** TASKS-I01–I06, B01–B12: bounded hierarchy, completion, deletion provenance and fenced edits. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { writeAudit } from '@/core/db/http-repo';
import { settingValue } from '@/core/db/settings-repo';
import { defaults } from '@/core/config/defaults';
import { filtersHash } from '@/core/http/pagination';
import { AppError } from '@/core/http/errors';
import { dayAt, addDays, bandOf } from '@/core/time/tasks';
import { getPerson } from '@/modules/people';
import {
  Task,
  TaskDetail,
  View,
  type TaskCreate,
  type TaskPatch,
  type TaskListQuery,
  type Group,
  type Reorder,
} from './schema/validation';
import * as repo from './repo';
const Cursor = z.strictObject({ v: z.literal(1), hash: z.string(), tuple: z.string() });
function readCursor(cursor: string | undefined, hash: string) {
  if (!cursor) return null;
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    if (parsed.hash !== hash) throw new Error('cursor filters changed');
    const tuple = z
      .array(z.union([z.string(), z.number()]))
      .min(2)
      .max(5)
      .parse(JSON.parse(parsed.tuple));
    return JSON.stringify(tuple);
  } catch {
    throw new AppError('validation_failed', { fieldErrors: { cursor: ['invalid_cursor'] } });
  }
}
export async function listTasks(ctx: Context, query: TaskListQuery) {
  const timezone = z
    .string()
    .parse((await settingValue(ctx.db, 'workspace.timezone')) ?? defaults.timezone);
  const today = dayAt(timezone);
  const dates = [today, addDays(today, 7), addDays(today, -90)];
  const { cursor, withTotal, limit, ...filters } = query;
  void withTotal;
  const hash = filtersHash(z.json().parse({ ...filters, today, timezone }));
  const rows = await repo.selectTasks(
    ctx.db,
    query,
    dates,
    query.sort,
    limit + 1,
    readCursor(cursor, hash),
  );
  const counts = z
    .record(View, z.number())
    .parse(await repo.countTasks(ctx.db, query, View.options, dates));
  const data = rows
    .slice(0, limit)
    .map((row) => TaskDetail.parse({ ...row, band: bandOf(row, today) }));
  const last = data.at(-1);
  const tuple =
    rows.length > limit && last
      ? await repo.cursorTuple(ctx.db, last.id, query.sort, today, addDays(today, 7))
      : null;
  return {
    data,
    meta: {
      counts,
      total: counts[query.view],
      today,
      timezone,
      defaultView: z.enum(['today', 'next']).parse(counts.today > 0 ? 'today' : 'next'),
      nextCursor: tuple
        ? Buffer.from(JSON.stringify({ v: 1, hash, tuple })).toString('base64url')
        : null,
    },
  };
}
export async function getTask(ctx: Context, taskId: string, deleted = false) {
  const row = await repo.selectTask(ctx.db, taskId);
  if (!row || (!deleted && row.deletedAt)) throw new AppError('not_found', { entityType: 'task' });
  const children = await repo.selectChildren(ctx.db, taskId, true);
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
  const task = await getTask(ctx, taskId, deleted);
  if (task.revision !== revision)
    throw new AppError('conflict', { reason: 'revision', current: task });
  return task;
}
async function update(
  ctx: Context,
  task: Task,
  patch: Parameters<typeof repo.updateTask>[3],
  action = 'update',
  opId?: string,
) {
  const row = await repo.updateTask(ctx.db, task.id, task.revision, {
    ...patch,
    updatedBy: ctx.user.id,
  });
  if (!row)
    throw new AppError('conflict', {
      reason: 'revision',
      current: await getTask(ctx, task.id, true),
    });
  await writeAudit(
    ctx.db,
    ctx.user.id,
    action,
    'task',
    task.id,
    z.json().parse(JSON.parse(JSON.stringify(patch))),
    opId,
  );
  return row;
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
  await writeAudit(ctx.db, ctx.user.id, 'create', 'task', row.id, z.json().parse(input));
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
      (await repo.selectChildren(ctx.db, taskId, true)).length
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
    const row = await repo.selectTask(ctx.db, taskId);
    if (
      !row ||
      row.deletedAt ||
      row.parentId ||
      (await repo.selectChildren(ctx.db, taskId, true)).length
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
  const rows = input.parentId ? await repo.selectChildren(ctx.db, input.parentId) : [];
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
export async function homeSummary(ctx: Context) {
  const timezone = z
    .string()
    .parse((await settingValue(ctx.db, 'workspace.timezone')) ?? defaults.timezone);
  const row = await repo.selectHomeSummary(ctx.db, dayAt(timezone));
  return ['overdue', 'today', 'waiting'].map((key) => ({
    key,
    enabled: true,
    count: z.number().parse(row[key + 'Count']),
    items: z.array(z.object({ id: z.uuid(), title: z.string() })).parse(row[key + 'Items']),
  }));
}
