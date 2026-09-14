import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool, type Database } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { createTask } from '@/modules/tasks/service';
import { TaskCreate } from '@/modules/tasks/schema/validation';
import { createPerson } from '@/modules/people';
import { createCommittee, patchCommittee, removeCommittee } from '@/modules/committees/service';
import { CommitteeCreate } from '@/modules/committees/schema/validation';
import { PersonCreate } from '@/modules/people/schema/validation';
import { homeSummary } from '../service';
let user: User;
const run = <T>(action: (ctx: { db: Database; user: User; requestId: string }) => Promise<T>) =>
  db().transaction((database) => action({ db: database, user, requestId: id() }));
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(
    sql`truncate tasks, notes, committees, people, users, settings, audit_log cascade`,
  );
  user = User.parse(
    await insertUser(db(), {
      id: id(),
      name: 'Home Tester',
      email: 'h@example.test',
      passwordHash: 'x',
      role: 'admin',
    }),
  );
});
afterAll(() => pool().end());
it('HOME-B02 HOME-B03 aggregates installed task sections, counts people, and collapses absent modules', async () => {
  await run((ctx) =>
    createTask(ctx, TaskCreate.parse({ title: 'Overdue report', dueDate: '2000-01-01' })),
  );
  await run((ctx) => createTask(ctx, TaskCreate.parse({ title: 'Someday', status: 'someday' })));
  await run((ctx) =>
    createPerson(
      ctx,
      PersonCreate.parse({
        fullName: 'Directory Person',
        kind: 'external',
        isAssignable: false,
        tags: [],
        email: null,
        phone: null,
        notes: null,
        displayName: null,
        honorific: null,
        organization: null,
        roleTitle: null,
        userId: null,
      }),
    ),
  );
  const home = await run((ctx) => homeSummary(ctx));
  expect(home.name).toBe('Home Tester');
  expect(home.principal).toBeNull();
  expect(home.peopleCount).toBe(1);
  const section = (key: string) => home.sections.find((item) => item.key === key);
  expect(section('overdue')).toMatchObject({ enabled: true, count: 1 });
  expect(section('overdue')?.items.map((item) => item.title)).toEqual(['Overdue report']);
  expect(section('today')).toMatchObject({ enabled: true, count: 0, items: [] });
  expect(section('nextMeetings')).toMatchObject({ enabled: false, count: 0, items: [] });
  expect(section('kpis')).toMatchObject({ enabled: false });
});

it('COMM-B06 HOME-B01 lists active committees carrying open work, busiest first', async () => {
  const busy = await run((ctx) =>
    createCommittee(ctx, CommitteeCreate.parse({ name: 'Consumer protection' })),
  );
  const quiet = await run((ctx) =>
    createCommittee(ctx, CommitteeCreate.parse({ name: 'Digital transactions' })),
  );
  const idle = await run((ctx) =>
    createCommittee(ctx, CommitteeCreate.parse({ name: 'No open work' })),
  );
  const archived = await run((ctx) =>
    createCommittee(ctx, CommitteeCreate.parse({ name: 'Archived committee' })),
  );
  const open = (title: string, committeeId: string) =>
    run((ctx) => createTask(ctx, TaskCreate.parse({ title, committeeId })));
  await open('First', busy.id);
  await open('Second', busy.id);
  await open('Third', quiet.id);
  await open('Archived work', archived.id);
  await run((ctx) =>
    patchCommittee(ctx, archived.id, { status: 'archived', revision: archived.revision }),
  );
  const home = await run((ctx) => homeSummary(ctx));
  const committees = home.sections.find((item) => item.key === 'committees');
  expect(committees).toMatchObject({ enabled: true, count: 2 });
  expect(committees?.items.map((item) => item.title)).toEqual([
    'Consumer protection',
    'Digital transactions',
  ]);
  expect(committees?.items.some((item) => item.title === 'No open work')).toBe(false);
  expect(idle.id).toBeTruthy();
});
it('COMM-B06 drops a committee from the section once it is trashed', async () => {
  const committee = await run((ctx) =>
    createCommittee(ctx, CommitteeCreate.parse({ name: 'Temporary' })),
  );
  await run((ctx) =>
    createTask(ctx, TaskCreate.parse({ title: 'Open item', committeeId: committee.id })),
  );
  const before = await run((ctx) => homeSummary(ctx));
  expect(before.sections.find((item) => item.key === 'committees')).toMatchObject({ count: 1 });
  await run((ctx) => removeCommittee(ctx, committee.id, committee.revision));
  const after = await run((ctx) => homeSummary(ctx));
  expect(after.sections.find((item) => item.key === 'committees')).toMatchObject({
    count: 0,
    items: [],
  });
});
