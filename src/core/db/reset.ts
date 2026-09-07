import 'server-only';
import { env } from '@/core/config/env';
import { db } from './client';
import { migrateDatabase } from './migrate';
import { sql } from 'drizzle-orm';
export async function resetDatabase() {
  if (env().NODE_ENV === 'production') throw new Error('Reset is development-only');
  await db().execute(sql`drop schema public cascade`);
  await db().execute(sql`create schema public`);
  await db().execute(sql`drop schema if exists drizzle cascade`);
  await migrateDatabase();
}
