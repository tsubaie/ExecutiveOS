import 'server-only';
import { eq } from 'drizzle-orm';
import { type Database } from './client';
import { aiCredentials } from './system-schema';
export async function readAiCredentials(database: Database) {
  const [row] = await database.select().from(aiCredentials).where(eq(aiCredentials.id, 1));
  return row;
}
export async function saveAiCredentials(
  database: Database,
  provider: string,
  encryptedKey: string,
) {
  const value = { provider, encryptedKey, updatedAt: new Date() };
  await database
    .insert(aiCredentials)
    .values({ id: 1, ...value })
    .onConflictDoUpdate({ target: aiCredentials.id, set: value });
}
export async function deleteAiCredentials(database: Database) {
  await database.delete(aiCredentials).where(eq(aiCredentials.id, 1));
}
