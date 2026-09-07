import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { pool } from './client';
import { defaults } from '@/core/config/defaults';

export async function migrateDatabase() {
  const connection = await pool().connect();
  const database = drizzle(connection);
  try {
    await database.execute(sql`select pg_advisory_lock(${defaults.migrationLock})`);
    await migrate(database, { migrationsFolder: './drizzle' });
  } finally {
    await database.execute(sql`select pg_advisory_unlock(${defaults.migrationLock})`);
    connection.release();
  }
}
