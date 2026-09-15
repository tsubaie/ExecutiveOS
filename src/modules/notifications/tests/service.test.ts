import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { notifications } from '@/core/db/system-schema';
import { tasks } from '@/modules/tasks/schema/db';
import { patchTask } from '@/modules/tasks/service';
import { TaskPatch } from '@/modules/tasks/schema/validation';
import * as service from '../service';
import { harness } from './fixtures';
const { run } = harness;
const feed = () => run((ctx) => service.feed(ctx, 20, null), harness.member ?? undefined);
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(() => harness.reset());
afterAll(() => pool().end());

it('NOTIF-B01 NOTIF-B04 writes one row for the assigned person and names the actor', async () => {
  const member = harness.member;
  if (!member) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  const task = await harness.task('Review the board pack', { ownerId: person.id });
  const page = await feed();
  expect(page.items).toHaveLength(1);
  expect(page.unread).toBe(1);
  expect(page.items[0]).toMatchObject({
    kind: 'task.assigned',
    subjectId: task.id,
    title: 'Review the board pack',
    actorName: 'Assigning Actor',
    readAt: null,
  });
});

it('NOTIF-B02 does not notify the reader of their own action', async () => {
  const actor = harness.actor;
  if (!actor) throw new Error('harness');
  const person = await harness.personFor(actor, 'Assigning Actor');
  await harness.task('A task I gave myself', { ownerId: person.id });
  const page = await run((ctx) => service.feed(ctx, 20, null), actor);
  expect(page.items).toHaveLength(0);
  expect(page.unread).toBe(0);
});

it('NOTIF-B04 writes nothing for a person with no account', async () => {
  const person = await harness.unlinkedPerson('External Adviser');
  await harness.task('Work for someone who cannot sign in', { ownerId: person.id });
  const rows = await db().select().from(notifications);
  expect(rows).toHaveLength(0);
});

it('NOTIF-B03 NOTIF-I02 refreshes an unread notification rather than stacking it', async () => {
  const member = harness.member;
  if (!member) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  const task = await harness.task('Reassigned repeatedly', { ownerId: person.id });
  const first = await feed();
  const firstAt = first.items[0]?.createdAt;
  for (let round = 0; round < 3; round += 1) {
    const current = await run((ctx) => ctx.db.select().from(tasks).where(eq(tasks.id, task.id)));
    const revision = current[0]?.revision ?? 1;
    await run((ctx) => patchTask(ctx, task.id, TaskPatch.parse({ revision, ownerId: null })));
    const cleared = await run((ctx) => ctx.db.select().from(tasks).where(eq(tasks.id, task.id)));
    await run((ctx) =>
      patchTask(
        ctx,
        task.id,
        TaskPatch.parse({ revision: cleared[0]?.revision ?? revision + 1, ownerId: person.id }),
      ),
    );
  }
  const page = await feed();
  expect(page.items).toHaveLength(1);
  expect(page.unread).toBe(1);
  // The refresh moves it forward rather than leaving the first arrival's time in place.
  expect(new Date(page.items[0]?.createdAt ?? 0).getTime()).toBeGreaterThanOrEqual(
    new Date(firstAt ?? 0).getTime(),
  );
});

it('NOTIF-B03 inserts again once the first has been read, because it is news again', async () => {
  const member = harness.member;
  if (!member) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  const task = await harness.task('Read then reassigned', { ownerId: person.id });
  const page = await feed();
  const first = page.items[0]?.id;
  if (!first) throw new Error('no notification');
  await run((ctx) => service.readOne(ctx, first), member);
  const current = await run((ctx) => ctx.db.select().from(tasks).where(eq(tasks.id, task.id)));
  const revision = current[0]?.revision ?? 1;
  await run((ctx) => patchTask(ctx, task.id, TaskPatch.parse({ revision, ownerId: null })));
  const cleared = await run((ctx) => ctx.db.select().from(tasks).where(eq(tasks.id, task.id)));
  await run((ctx) =>
    patchTask(
      ctx,
      task.id,
      TaskPatch.parse({ revision: cleared[0]?.revision ?? revision + 1, ownerId: person.id }),
    ),
  );
  const after = await feed();
  expect(after.items).toHaveLength(2);
  expect(after.unread).toBe(1);
});

it('NOTIF-B06 NOTIF-B08 drops a notification whose subject is gone, without deleting the row', async () => {
  const member = harness.member;
  if (!member) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  const task = await harness.task('About to be trashed', { ownerId: person.id });
  expect((await feed()).unread).toBe(1);
  await db().update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, task.id));
  const page = await feed();
  expect(page.items).toHaveLength(0);
  expect(page.unread).toBe(0);
  // The row survives: the subject may be restored (NOTIF-B06).
  expect(await db().select().from(notifications)).toHaveLength(1);
});

it('NOTIF-I04 never returns another reader rows', async () => {
  const member = harness.member;
  const actor = harness.actor;
  if (!member || !actor) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  await harness.task('Addressed to the member', { ownerId: person.id });
  const mine = await run((ctx) => service.feed(ctx, 20, null), actor);
  expect(mine.items).toHaveLength(0);
  expect(mine.unread).toBe(0);
});

it('NOTIF-B07 marks read only what the reader could actually see', async () => {
  const member = harness.member;
  if (!member) throw new Error('harness');
  const person = await harness.personFor(member, 'Receiving Member');
  await harness.task('Visible', { ownerId: person.id });
  const hidden = await harness.task('Hidden', { ownerId: person.id });
  await db().update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, hidden.id));
  const result = await run((ctx) => service.readAll(ctx), member);
  expect(result.marked).toBe(1);
  const rows = await db().select().from(notifications);
  expect(rows.filter((row) => row.readAt === null)).toHaveLength(1);
});
