import { sql, eq } from 'drizzle-orm';
import { db, type Database } from '@/core/db/client';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { createPerson } from '@/modules/people';
import { PersonCreate, personDraft } from '@/modules/people/schema/validation';
import { people } from '@/modules/people/schema/db';
import { createTask } from '@/modules/tasks/service';
import { TaskCreate } from '@/modules/tasks/schema/validation';
export type Ctx = { db: Database; user: User; requestId: string };
// Two accounts, because every behaviour worth testing here is about one reader being told
// something another reader did: NOTIF-B02 means an actor is never their own recipient, so a
// one-actor harness would make every scenario vacuously pass.
export const harness = {
  actor: null as User | null,
  member: null as User | null,
  run<T>(action: (ctx: Ctx) => Promise<T>, as?: User) {
    const user = as ?? harness.actor;
    if (!user) throw new Error('reset the harness before running a scenario');
    return db().transaction((database) => action({ db: database, user, requestId: id() }));
  },
  async reset() {
    await db().execute(
      sql`truncate notifications, notes, note_people, tasks, people, users, settings, audit_log cascade`,
    );
    harness.actor = await account('Assigning Actor', 'actor@example.test', 'admin');
    harness.member = await account('Receiving Member', 'member@example.test', 'member');
  },
  // A directory record linked to an account (ADR 0011): the only shape that can be notified.
  async personFor(user: User, fullName: string) {
    const created = await harness.run((ctx) =>
      createPerson(ctx, PersonCreate.parse({ ...personDraft(fullName), isAssignable: true })),
    );
    if (!created.data) throw new Error('person not created');
    await db().update(people).set({ userId: user.id }).where(eq(people.id, created.data.id));
    return created.data;
  },
  // A person with no login — every external person. NOTIF-B04 says they are never a recipient.
  async unlinkedPerson(fullName: string) {
    const created = await harness.run((ctx) =>
      createPerson(ctx, PersonCreate.parse({ ...personDraft(fullName), isAssignable: true })),
    );
    if (!created.data) throw new Error('person not created');
    return created.data;
  },
  task(title: string, fields: Partial<TaskCreate> = {}) {
    return harness.run((ctx) => createTask(ctx, TaskCreate.parse({ title, ...fields })));
  },
};
async function account(name: string, email: string, role: 'admin' | 'member') {
  return User.parse(
    await insertUser(db(), { id: id(), name, email, passwordHash: 'unused-test-hash', role }),
  );
}
