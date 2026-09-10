import 'server-only';
import { and, eq, gt, isNull, sql, or } from 'drizzle-orm';
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
// ADMIN-B20: the email and the client address are independent buckets, counted in one statement so
// the login path stays inside the per-request query budget. A null key counts nothing rather than
// matching every row: an address the deployment cannot resolve is not a bucket anyone shares.
export async function loginFailures(
  database: Database,
  email: string | null,
  address: string | null,
) {
  if (email === null && address === null) return { byEmail: 0, byAddress: 0 };
  const [row] = await database
    .select({
      byEmail: sql<number>`count(*) filter (where ${loginAttempts.email} = ${email})`.mapWith(
        Number,
      ),
      byAddress: sql<number>`count(*) filter (where ${loginAttempts.ip} = ${address})`.mapWith(
        Number,
      ),
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.createdAt, new Date(Date.now() - 900000)),
        or(
          email === null ? undefined : eq(loginAttempts.email, email),
          address === null ? undefined : eq(loginAttempts.ip, address),
        ),
      ),
    );
  return { byEmail: row?.byEmail ?? 0, byAddress: row?.byAddress ?? 0 };
}
export async function lockLogin(database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(7233)`);
}
// An unresolved address and the recovery route's absent email are both stored as the empty string:
// the column is NOT NULL, and loginFailures only ever compares against a real key, so an empty
// value can never join a bucket.
export async function recordLogin(
  database: Database,
  email: string | null,
  ip: string | null,
  succeeded: boolean,
) {
  await database
    .insert(loginAttempts)
    .values({ id: id(), email: email ?? '', ip: ip ?? '', succeeded });
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
