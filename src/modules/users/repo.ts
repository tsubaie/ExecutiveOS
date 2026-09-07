import 'server-only';
import { eq, and, count, isNull } from 'drizzle-orm';
import { users, sessions } from '@/core/db/system-schema';
import type { Database } from '@/core/db/client';
import { updateEntity } from '@/core/db/entity';
export function selectUsers(database: Database) {
  return database.select().from(users).where(isNull(users.deletedAt)).orderBy(users.name);
}
export async function countAdmins(database: Database) {
  const [row] = await database
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.isActive, true), isNull(users.deletedAt)));
  return row?.count ?? 0;
}
export async function updateUser(
  database: Database,
  userId: string,
  patch: { name: string; role: string; isActive: boolean; revision: number },
  actorId: string,
) {
  const { revision, ...fields } = patch;
  const row = await updateEntity<typeof users.$inferSelect>(
    database,
    users,
    userId,
    revision,
    fields,
    actorId,
  );
  if (row && !patch.isActive)
    await database
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, userId));
  return row;
}
