/** TASKS-I01–I06, B01–B12, B16: bounded hierarchy, completion, provenance, fenced edits, source note. */
import 'server-only';
import { requireCommittee } from '@/modules/committees';
import { userIdsForPeople } from '@/modules/people';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { toJson, writeAudit } from '@/core/db/audit-repo';
import { getSetting } from '@/core/db/settings-repo';
import { decodeCursor, encodeCursor, filtersHash } from '@/core/db/keyset';
import { applyUpdate, requireRevision, type EntityOps } from '@/core/entity/service';
import { AppError } from '@/core/http/errors';
import { routes } from '@/core/routes';
import { emit } from '@/core/notifications/emit';
import type { HomeSection } from '@/core/modules/server-manifest';
import { dayAt, addDays, bandOf } from '@/core/time/tasks';
import { aiPeople, getPerson, personNameSql } from '@/modules/people';
import { getNote } from '@/modules/notes';
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
      // TASKS-B16: meta.total is opt-in (04-api-conventions.md); the view counts always ship.
      ...(withTotal === 'true' ? { total: counts[query.view] } : {}),
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
  // TASKS-B03: the band is computed, not stored, and the detail used to skip the computation and
  // fall through to the schema default. The same task then read `overdue` in a list and `null` in
  // its own record, so the panel could not say how late it was while the row it was opened from
  // could. One `today` for the task and its children, the same one the list uses.
  const today = dayAt(await getSetting(ctx.db, 'workspace.timezone'));
  const banded = <T extends { status: string; dueDate: string | null }>(task: T) => ({
    ...task,
    band: bandOf(task, today),
  });
  return TaskDetail.parse({
    ...banded(row),
    subtasks: (deleted ? children : children.filter((child) => !child.deletedAt)).map(banded),
    deletedSubtasks: (deleted ? [] : children.filter((child) => child.deletedAt)).map(banded),
  });
}
async function owner(ctx: Context, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const person = await getPerson(ctx, ownerId);
  if (!person.isAssignable) throw new AppError('rule_violation', { rule: 'TASKS-B10' });
}
// TASKS-B16: a source note must exist; attaching by PATCH needs an open, top-level, unlinked task.
async function sourceNote(
  ctx: Context,
  noteId: string | null | undefined,
  task?: { status: string; parentId: string | null; sourceNoteId: string | null },
) {
  if (!noteId) return;
  if (
    task &&
    (task.status === 'completed' ||
      task.parentId ||
      (task.sourceNoteId && task.sourceNoteId !== noteId))
  )
    throw new AppError('rule_violation', { rule: 'TASKS-B16' });
  await getNote(ctx, noteId);
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
  await requireCommittee(ctx, input.committeeId);
  await repo.lockTasks(ctx.db);
  await owner(ctx, input.ownerId);
  await sourceNote(ctx, input.sourceNoteId);
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
  await notifyAssigned(ctx, row.id, input.title, null, input.ownerId ?? null);
  return getTask(ctx, row.id);
}
export async function patchTask(ctx: Context, taskId: string, input: TaskPatch) {
  if (input.status === 'completed') throw new AppError('rule_violation', { rule: 'TASKS-B02' });
  const task = await current(ctx, taskId, input.revision);
  await requireCommittee(ctx, input.committeeId, task.committeeId);
  await owner(ctx, input.ownerId);
  await sourceNote(ctx, input.sourceNoteId, task);
  const { revision, ...fields } = input;
  void revision;
  await update(ctx, task, { ...fields, ...(fields.status ? { completedAt: null } : {}) });
  if (fields.ownerId !== undefined)
    await notifyAssigned(ctx, taskId, task.title, task.ownerId, fields.ownerId);
  return getTask(ctx, taskId);
}
// NOTIF-B04 `task.assigned`: emitted when a task comes to rest with an owner who is not the person
// doing the assigning, in the same transaction as the change (NOTIF-B01). Unassigning notifies
// nobody -- there is no one to tell -- and re-assigning to the same person is not an event.
async function notifyAssigned(
  ctx: Context,
  taskId: string,
  title: string,
  from: string | null,
  to: string | null | undefined,
) {
  if (!to || to === from) return;
  await emit(ctx, {
    kind: 'task.assigned',
    subjectType: 'tasks',
    subjectId: taskId,
    payload: { actorName: ctx.user.name, title },
    to: await userIdsForPeople(ctx, [to]),
  });
}
// TASKS-B02: one completion is one operation. Every row it actually changes is recorded with the
// state it held beforehand, so Undo restores each of them exactly rather than guessing a status.
// `reopenTask` stays the reader's own command and keeps writing `next_action`; it is not Undo, and
// using it as one would lose the inbox, waiting or someday a task was completed from.
export async function completeTask(ctx: Context, taskId: string, revision: number, force = false) {
  const task = await current(ctx, taskId, revision);
  const open = task.subtasks.filter((child) => child.status !== 'completed');
  if (open.length && !force)
    throw new AppError('conflict', { reason: 'state', openSubtasks: open.length });
  const opId = id();
  await repo.insertCompletion(ctx.db, { id: opId, rootTaskId: taskId, actorId: ctx.user.id });
  const fields = { status: 'completed', completedAt: new Date() };
  // Children first and the requested row last, the order deletion already uses.
  const items = [];
  for (const child of open) items.push(await completeRow(ctx, child, fields, opId));
  items.push(await completeRow(ctx, task, fields, opId));
  await repo.insertCompletionItems(ctx.db, items);
  return { task: await getTask(ctx, taskId), opId };
}
async function completeRow(
  ctx: Context,
  task: { id: string; revision: number; status: string; completedAt: string | null },
  fields: Patch,
  opId: string,
) {
  const row = await update(ctx, task, fields, 'complete', opId);
  return {
    completionId: opId,
    taskId: task.id,
    previousStatus: task.status,
    previousCompletedAt: task.completedAt ? new Date(task.completedAt) : null,
    completedRevision: row.revision,
  };
}
export async function undoCompleteTask(ctx: Context, taskId: string, opId: string) {
  await repo.lockTasks(ctx.db);
  const operation = await repo.lockCompletion(ctx.db, opId);
  if (!operation || operation.rootTaskId !== taskId)
    throw new AppError('conflict', { reason: 'state' });
  // A repeated Undo is a replay, not a second write: the reader pressed twice, or the request was
  // retried. Return what the first one left behind.
  if (operation.status === 'undone') return getTask(ctx, taskId);
  const plan = [];
  for (const item of await repo.selectCompletionItems(ctx.db, opId))
    plan.push({ item, row: await getTask(ctx, item.taskId, true) });
  // Every row is checked before any is written: an Undo that restored half an operation and then
  // refused would leave the cascade in a state nobody asked for.
  for (const { item, row } of plan)
    if (row.status !== 'completed' || row.revision !== item.completedRevision)
      throw new AppError('conflict', { reason: 'state' });
  for (const { item, row } of plan)
    await update(ctx, row, patchOf(item), 'undo_complete', opId);
  await repo.markCompletionUndone(ctx.db, opId);
  return getTask(ctx, taskId);
}
const patchOf = (item: { previousStatus: string; previousCompletedAt: Date | null }) => ({
  status: item.previousStatus,
  completedAt: item.previousCompletedAt,
});
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
    sourceNoteId: null,
    committeeId: children.every((child) => child.committeeId === children[0]?.committeeId)
      ? (children[0]?.committeeId ?? null)
      : null,
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
export async function homeSummary(ctx: Context, today: string): Promise<HomeSection[]> {
  const row = await repo.selectHomeSummary(ctx.db, today);
  const task = z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      revision: z.number(),
      date: z.string().nullable(),
      owner: z.string().nullable(),
      committee: z.string().nullable(),
    }),
  );
  const sections = ['overdue', 'today'].map((key) => ({
    key,
    enabled: true,
    count: z.number().parse(row[key + 'Count']),
    href: routes.tasks({ view: key }),
    stale: key === 'overdue' ? z.number().parse(row['overdueStale']) : null,
    items: task
      .parse(row[key + 'Items'])
      .map((item) => ({ ...item, href: routes.tasks({ view: 'all', id: item.id }) })),
  }));
  // HOME-B10: one row per person holding work, not one per task.
  const holders = z
    .array(z.object({ id: z.uuid(), title: z.string(), count: z.number() }))
    .parse(row['waitingPeople']);
  return [
    ...sections,
    {
      key: 'waiting',
      enabled: true,
      count: z.number().parse(row['waitingCount']),
      href: routes.tasks({ view: 'waiting' }),
      items: holders.map((holder) => ({
        ...holder,
        owner: holder.title,
        href: routes.tasks({ view: 'waiting', ownerId: holder.id }),
      })),
    },
  ];
}

export function peopleForAi(ctx: Context) {
  return aiPeople(ctx);
}
