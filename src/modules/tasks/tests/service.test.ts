import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { users } from '@/core/db/system-schema';
import { people } from '@/modules/people/schema/db';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { env } from '@/core/config/env';
import { tasks } from '../schema/db';
import { TaskCreate, TaskListQuery, TaskPatch } from '../schema/validation';
import * as service from '../service';
const actorId = id();
let user: User;
const run = <T>(action: (ctx: { db: Database; user: User; requestId: string }) => Promise<T>) =>
  db().transaction((database) => action({ db: database, user, requestId: id() }));
const create = (title: string, fields: Partial<TaskCreate> = {}) =>
  run((ctx) => service.createTask(ctx, TaskCreate.parse({ title, ...fields })));
beforeAll(async () => {
  if (!new URL(env().DATABASE_URL).pathname.endsWith('_test'))
    throw new Error('Dedicated test database required');
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate tasks, people, users, settings, audit_log cascade`);
  const [row] = await db()
    .insert(users)
    .values({
      id: actorId,
      name: 'Task Tester',
      email: 'tasks@example.test',
      passwordHash: 'unused-test-hash',
      role: 'admin',
    })
    .returning();
  user = User.parse(row);
});
afterAll(() => pool().end());
it('TASKS-A01 TASKS-B01 TASKS-B04 TASKS-B06 counts exclude children and normalized search matches Arabic', async () => {
  const parent = await create('إِعداد التقرير', { description: 'Budget outline' });
  await create('Child', { parentId: parent.id });
  const result = await run((ctx) =>
    service.listTasks(ctx, TaskListQuery.parse({ view: 'inbox', q: 'اعداد' })),
  );
  expect(result.data.map((task) => task.id)).toEqual([parent.id]);
  expect(result.meta.counts.inbox).toBe(1);
  expect(result.meta.counts.all).toBe(1);
  expect(result.data[0]?.status).toBe('inbox');
  expect(result.data[0]?.priority).toBeNull();
});
it('TASKS-I01 TASKS-I02 TASKS-B08 rejects depth two, self parenting, and converting parents', async () => {
  const parent = await create('Parent');
  const child = await create('Child', { parentId: parent.id });
  await expect(create('Grandchild', { parentId: child.id })).rejects.toMatchObject({
    code: 'rule_violation',
  });
  await expect(run((ctx) => service.moveTask(ctx, parent.id, 1, parent.id))).rejects.toMatchObject({
    code: 'rule_violation',
  });
  await expect(
    db().update(tasks).set({ parentId: child.id }).where(eq(tasks.id, parent.id)),
  ).rejects.toThrow();
  const converted = await run((ctx) => service.moveTask(ctx, child.id, 1, null));
  expect(converted.parentId).toBeNull();
});
it('TASKS-I03 TASKS-B02 TASKS-A03 completion refuses open children, force completes all, reopen leaves children completed', async () => {
  const parent = await create('Parent');
  await create('Child', { parentId: parent.id });
  await expect(run((ctx) => service.completeTask(ctx, parent.id, 1))).rejects.toMatchObject({
    code: 'conflict',
    details: { openSubtasks: 1 },
  });
  await expect(
    run((ctx) => service.patchTask(ctx, parent.id, { revision: 1, status: 'completed' })),
  ).rejects.toMatchObject({ code: 'rule_violation', details: { rule: 'TASKS-B02' } });
  const complete = await run((ctx) => service.completeTask(ctx, parent.id, 1, true));
  expect(complete.completedAt).not.toBeNull();
  expect(complete.subtasks.every((task) => task.status === 'completed')).toBe(true);
  const reopened = await run((ctx) => service.reopenTask(ctx, parent.id, complete.revision));
  expect(reopened.status).toBe('next_action');
  expect(reopened.completedAt).toBeNull();
  expect(reopened.subtasks[0]?.status).toBe('completed');
  await expect(
    db().update(tasks).set({ completedAt: new Date() }).where(eq(tasks.id, parent.id)),
  ).rejects.toThrow();
});
it('TASKS-I04 TASKS-B11 TASKS-A04 restore only the matching delete operation', async () => {
  const parent = await create('Parent');
  const older = await create('Older', { parentId: parent.id });
  const child = await create('Child', { parentId: parent.id });
  const own = await run((ctx) => service.removeTask(ctx, older.id, 1));
  const operation = await run((ctx) => service.removeTask(ctx, parent.id, 1));
  await expect(run((ctx) => service.restoreTask(ctx, older.id, own.opId))).rejects.toMatchObject({
    code: 'rule_violation',
  });
  await run((ctx) => service.restoreTask(ctx, parent.id, operation.opId));
  const result = await run((ctx) => service.getTask(ctx, parent.id, true));
  expect(result.subtasks.find((task) => task.id === older.id)?.deletedOpId).toBe(own.opId);
  expect(result.subtasks.find((task) => task.id === child.id)?.deletedAt).toBeNull();
});
it('TASKS-I05 TASKS-B09 TASKS-A05 grouping is atomic and reordering is deferred and revision checked', async () => {
  const children = await Promise.all(['One', 'Two', 'Three'].map((title) => create(title)));
  const parent = await run((ctx) =>
    service.groupTasks(ctx, { title: 'Group', childIds: children.map((task) => task.id) }),
  );
  expect(parent.subtasks.map((task) => task.title)).toEqual(['One', 'Two', 'Three']);
  const orderedIds = parent.subtasks.map((task) => task.id).reverse();
  const revisions = Object.fromEntries(parent.subtasks.map((task) => [task.id, task.revision]));
  const reordered = await run((ctx) =>
    service.reorderTasks(ctx, { parentId: parent.id, orderedIds, revisions }),
  );
  expect(reordered.subtasks.map((task) => task.id)).toEqual(orderedIds);
  await expect(
    run((ctx) => service.reorderTasks(ctx, { parentId: parent.id, orderedIds, revisions })),
  ).rejects.toMatchObject({ code: 'conflict' });
  const other = await create('Other');
  await expect(
    run((ctx) => service.groupTasks(ctx, { title: 'Invalid', childIds: [parent.id, other.id] })),
  ).rejects.toMatchObject({ details: { rule: 'TASKS-B09', ids: [parent.id] } });
  await expect(
    db().update(tasks).set({ sortOrder: 0 }).where(eq(tasks.id, orderedIds[1]!)),
  ).rejects.toThrow();
});
it('TASKS-B10 TASKS-I06 owner must be assignable and is retained through soft deletion', async () => {
  const personId = id();
  await db()
    .insert(people)
    .values({ id: personId, fullName: 'Example Assignee', isAssignable: false });
  await expect(create('Assigned', { ownerId: personId })).rejects.toMatchObject({
    details: { rule: 'TASKS-B10' },
  });
  await db().update(people).set({ isAssignable: true }).where(eq(people.id, personId));
  const task = await create('Assigned', { ownerId: personId });
  await db().update(people).set({ deletedAt: new Date() }).where(eq(people.id, personId));
  expect((await run((ctx) => service.getTask(ctx, task.id))).ownerId).toBe(personId);
  await db().delete(people).where(eq(people.id, personId));
  expect((await run((ctx) => service.getTask(ctx, task.id))).ownerId).toBeNull();
});
it('TASKS-B12 TASKS-A09 simultaneous edits yield one winner and latest revision permits reapply', async () => {
  const task = await create('Initial', {
    status: 'waiting_on',
    priority: 'urgent',
    dueDate: '2026-09-08',
  });
  const results = await Promise.allSettled(
    ['First', 'Second'].map((title) =>
      run((ctx) => service.patchTask(ctx, task.id, TaskPatch.parse({ title, revision: 1 }))),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const latest = await run((ctx) => service.getTask(ctx, task.id));
  expect(latest.revision).toBe(2);
  expect(latest).toMatchObject({ status: 'waiting_on', priority: 'urgent', dueDate: '2026-09-08' });
  expect(
    (
      await run((ctx) =>
        service.patchTask(ctx, task.id, { title: 'Reapplied', revision: latest.revision }),
      )
    ).title,
  ).toBe('Reapplied');
});
it('TASKS-B05 TASKS-B07 cursor continuation respects facets, null ordering and rejects changed filters', async () => {
  await create('Z undated');
  await create('A dated', { dueDate: '2026-09-08', priority: 'urgent' });
  await create('B undated');
  for (const sort of ['default', 'due_date', 'priority', 'title', 'created_at', 'updated_at']) {
    const first = await run((ctx) =>
      service.listTasks(ctx, TaskListQuery.parse({ sort, limit: 1 })),
    );
    const second = await run((ctx) =>
      service.listTasks(
        ctx,
        TaskListQuery.parse({ sort, limit: 2, cursor: first.meta.nextCursor }),
      ),
    );
    expect(new Set([...first.data, ...second.data].map((task) => task.id)).size).toBe(3);
    expect(second.meta.nextCursor).toBeNull();
    await expect(
      run((ctx) =>
        service.listTasks(
          ctx,
          TaskListQuery.parse({ sort, q: 'changed', cursor: first.meta.nextCursor }),
        ),
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
  }
  const filtered = await run((ctx) =>
    service.listTasks(ctx, TaskListQuery.parse({ priority: 'urgent', dueFrom: '2026-09-08' })),
  );
  expect(filtered.data).toHaveLength(1);
  expect(filtered.meta.total).toBe(1);
});

it('HOME-B01 HOME-B03 TASKS-B15 Home includes task counts and links, with five items per section', async () => {
  const { dayAt } = await import('@/core/time/tasks');
  const today = dayAt('UTC');
  for (let i = 0; i < 7; i++) await create(`Today ${i}`, { dueDate: today });
  await create('Overdue', { dueDate: '2000-01-01' });
  const sections = await run((ctx) => service.homeSummary(ctx));
  expect(sections.find((section) => section.key === 'today')?.count).toBe(7);
  expect(sections.find((section) => section.key === 'today')?.items).toHaveLength(5);
  expect(sections.find((section) => section.key === 'overdue')?.count).toBe(1);
});
it('TASKS-I04 TASKS-I05 restoring after reorder never collides with active sibling positions', async () => {
  const parent = await create('Parent');
  const one = await create('One', { parentId: parent.id });
  const two = await create('Two', { parentId: parent.id });
  const three = await create('Three', { parentId: parent.id });
  const deletion = await run((ctx) => service.removeTask(ctx, one.id, one.revision));
  await run((ctx) =>
    service.reorderTasks(ctx, {
      parentId: parent.id,
      orderedIds: [three.id, two.id],
      revisions: { [three.id]: three.revision, [two.id]: two.revision },
    }),
  );
  const detail = await run((ctx) => service.getTask(ctx, parent.id));
  expect(detail.deletedSubtasks.map((task) => task.id)).toEqual([one.id]);
  await run((ctx) => service.restoreTask(ctx, one.id, deletion.opId));
  expect((await run((ctx) => service.getTask(ctx, parent.id))).subtasks).toHaveLength(3);
});
