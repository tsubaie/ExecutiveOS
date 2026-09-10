import { sql } from 'drizzle-orm';
import { db, type Database } from '@/core/db/client';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { createPerson } from '@/modules/people';
import { PersonCreate } from '@/modules/people/schema/validation';
import { createTask } from '@/modules/tasks/service';
import { TaskCreate } from '@/modules/tasks/schema/validation';
import { NoteCreate } from '../schema/validation';
import * as service from '../service';
export type Ctx = { db: Database; user: User; requestId: string };
// Shared harness for the notes scenarios: a clean database, one admin actor, factories through
// the services so every row carries provenance.
export const harness = {
  user: null as User | null,
  run<T>(action: (ctx: Ctx) => Promise<T>) {
    const user = harness.user;
    if (!user) throw new Error('reset the harness before running a scenario');
    return db().transaction((database) => action({ db: database, user, requestId: id() }));
  },
  async reset() {
    await db().execute(
      sql`truncate notes, note_people, tasks, people, users, settings, audit_log cascade`,
    );
    harness.user = User.parse(
      await insertUser(db(), {
        id: id(),
        name: 'Notes Tester',
        email: 'notes@example.test',
        passwordHash: 'unused-test-hash',
        role: 'admin',
      }),
    );
  },
  note(title: string, fields: Partial<NoteCreate> = {}) {
    return harness.run((ctx) => service.createNote(ctx, NoteCreate.parse({ title, ...fields })));
  },
  async person(fullName: string, fields: Partial<PersonCreate> = {}) {
    const created = await harness.run((ctx) =>
      createPerson(
        ctx,
        PersonCreate.parse({
          fullName,
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
          confirmDuplicate: true,
          ...fields,
        }),
      ),
    );
    if (!created.data) throw new Error('person not created');
    return created.data;
  },
  task(title: string, fields: Partial<TaskCreate> = {}) {
    return harness.run((ctx) => createTask(ctx, TaskCreate.parse({ title, ...fields })));
  },
};
export function actorId() {
  if (!harness.user) throw new Error('reset the harness before reading the actor');
  return harness.user.id;
}
