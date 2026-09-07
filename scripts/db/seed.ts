import { db, pool } from '../../src/core/db/client';
import { User } from '../../src/core/auth/validation';
import { selectUsers } from '../../src/modules/users/repo';
import { createPerson } from '../../src/modules/people';
import { PersonCreate } from '../../src/modules/people/schema/validation';
import { seedPeople } from '../../tests/fixtures/people';
import { id } from '../../src/core/db/ids';
const user = (await selectUsers(db())).find((user) => user.role === 'admin' && user.isActive);
if (!user) throw new Error('Complete setup before loading preview people.');
await db().transaction(async (database) => {
  const ctx = { db: database, user: User.parse(user), requestId: id() };
  for (const person of seedPeople)
    await createPerson(
      ctx,
      PersonCreate.parse({
        ...person,
        displayName: null,
        honorific: null,
        email: null,
        phone: null,
        notes: null,
        tags: [],
        userId: null,
      }),
    );
});
await pool().end();
