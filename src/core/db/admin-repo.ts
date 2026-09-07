import 'server-only';
import { desc, eq, and } from 'drizzle-orm';
import { auditLog, jobs } from './system-schema';
import { type Database } from './client';
export function auditEntries(database: Database) {
  return database.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100);
}
export async function cancelJob(database: Database, id: string) {
  return database.update(jobs).set({ cancelRequested: true }).where(eq(jobs.id, id)).returning();
}
export async function readJob(database: Database, id: string) {
  const [row] = await database
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id)));
  return row;
}
