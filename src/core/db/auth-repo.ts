import 'server-only';
import { and, eq, gt, isNull, sql, count, or } from 'drizzle-orm';
import { db, type Database } from './client';
import { users, sessions, workspace, loginAttempts, recoveryTokens } from './system-schema';
import { id } from './ids';

export async function initialized(database: Database = db()) {
  const [row] = await database.select({ id: users.id }).from(users).limit(1);
  return Boolean(row);
}
export async function lockWorkspace(database: Database) {
  await database.insert(workspace).values({ id: 1 }).onConflictDoNothing();
  const [row] = await database.select().from(workspace).where(eq(workspace.id, 1)).for('update');
  if (!row) throw new Error('Workspace singleton missing');
  return row;
}
export async function setSetupToken(database: Database, setupTokenHash: string) {
  await database.update(workspace).set({ setupTokenHash }).where(eq(workspace.id, 1));
}
export async function finishSetup(database: Database) {
  await database
    .update(workspace)
    .set({ setupCompletedAt: new Date(), setupTokenHash: null })
    .where(eq(workspace.id, 1));
}
export async function userByEmail(database: Database, email: string) {
  const [row] = await database.select().from(users).where(eq(users.email, email));
  return row;
}
export async function insertUser(database: Database, input: typeof users.$inferInsert) {
  const [row] = await database.insert(users).values(input).returning();
  if (!row) throw new Error('User insert failed');
  return row;
}
export async function insertSession(database: Database, input: typeof sessions.$inferInsert) {
  await database.insert(sessions).values(input);
}
export async function sessionByHash(hash: string, database: Database = db()) {
  const [row] = await database
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        gt(sessions.absoluteExpiresAt, new Date()),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );
  return row;
}
export async function refreshSession(sessionId: string, expiry: Date, database: Database = db()) {
  await database
    .update(sessions)
    .set({ lastSeenAt: new Date(), expiresAt: expiry })
    .where(eq(sessions.id, sessionId));
}
export async function revokeSession(hash: string, database: Database = db()) {
  await database
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, hash));
}
export async function revokeUserSessions(database: Database, userId: string) {
  await database.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId));
}
export async function loginFailures(database: Database, email: string, ip: string) {
  const [row] = await database
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.createdAt, new Date(Date.now() - 900000)),
        or(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)),
      ),
    );
  return row?.count ?? 0;
}
export async function lockLogin(database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(7233)`);
}
export async function recordLogin(
  database: Database,
  email: string,
  ip: string,
  succeeded: boolean,
) {
  await database.insert(loginAttempts).values({ id: id(), email, ip, succeeded });
}
export async function usedRecovery(database: Database, hash: string) {
  const [row] = await database
    .select()
    .from(recoveryTokens)
    .where(eq(recoveryTokens.tokenHash, hash));
  return Boolean(row);
}
export async function recoverUser(
  database: Database,
  userId: string,
  hash: string,
  passwordHash: string,
) {
  await database.insert(recoveryTokens).values({ tokenHash: hash });
  await database
    .update(users)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
      revision: sql`${users.revision}+1`,
    })
    .where(eq(users.id, userId));
  await revokeUserSessions(database, userId);
}
