import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { users } from '@/core/db/system-schema';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { auditLog } from '@/core/db/system-schema';
import { tasks } from '../schema/db';
import { TaskCreate } from '../schema/validation';
import * as service from '../service';
const audit = vi.hoisted(() => ({ failOnCall: 0, calls: 0 }));
vi.mock('@/core/db/audit-repo', async (original) => {
  const actual = await original<typeof import('@/core/db/audit-repo')>();
  return {
    ...actual,
    writeAudit: async (...args: Parameters<typeof actual.writeAudit>) => {
      audit.calls += 1;
      if (audit.calls === audit.failOnCall)
        throw new Error(`injected at audit write ${audit.calls}`);
      return actual.writeAudit(...args);
    },
  };
});
let user: User;
const ctx = () => ({ db: db(), user, requestId: id() });
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate tasks, notes, people, users, settings, audit_log cascade`);
  const [row] = await db()
    .insert(users)
    .values({
      id: id(),
      name: 'Atomic',
      email: 'atomic@example.test',
      passwordHash: 'x',
      role: 'admin',
    })
    .returning();
  user = User.parse(row);
  audit.failOnCall = 0;
});
afterAll(() => pool().end());
async function family() {
  const parent = await service.createTask(ctx(), TaskCreate.parse({ title: 'Parent' }));
  await service.createTask(ctx(), TaskCreate.parse({ title: 'First', parentId: parent.id }));
  await service.createTask(ctx(), TaskCreate.parse({ title: 'Second', parentId: parent.id }));
  return parent;
}
it('ADMIN-B36 TASKS-B02 completion called directly leaves nothing behind when any step fails', async () => {
  const parent = await family();
  const before = await db().select().from(tasks).orderBy(tasks.title);
  const audits = (await db().select().from(auditLog)).length;
  // Three rows change, each audited; fail after each intermediate write in turn.
  for (const failAt of [1, 2, 3]) {
    audit.calls = 0;
    audit.failOnCall = failAt;
    await expect(service.completeTask(ctx(), parent.id, 1, true)).rejects.toThrow(
      `injected at audit write ${failAt}`,
    );
    expect(await db().select().from(tasks).orderBy(tasks.title)).toEqual(before);
    expect((await db().select().from(auditLog)).length).toBe(audits);
  }
  audit.failOnCall = 0;
  const { task } = await service.completeTask(ctx(), parent.id, 1, true);
  expect(task.subtasks.every((child) => child.status === 'completed')).toBe(true);
  const [stored] = await db().select().from(tasks).where(eq(tasks.id, parent.id));
  expect(stored?.status).toBe('completed');
});
