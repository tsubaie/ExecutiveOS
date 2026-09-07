import 'server-only';
import { eq, and, count, sql, isNull } from 'drizzle-orm';
import { users, sessions } from '@/core/db/system-schema';
import type { Database } from '@/core/db/client';
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
) {
  const [row] = await database
    .update(users)
    .set({ ...patch, updatedAt: new Date(), revision: sql`${users.revision}+1` })
    .where(and(eq(users.id, userId), eq(users.revision, patch.revision)))
    .returning();
  if (row && !patch.isActive)
    await database
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, userId));
  return row;
}
