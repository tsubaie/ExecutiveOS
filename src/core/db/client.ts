import 'server-only';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '@/core/config/env';

let connection: pg.Pool | undefined;
export function pool() {
  connection ??= new pg.Pool({ connectionString: env().DATABASE_URL, max: 12 });
  return connection;
}
export function db() {
  return drizzle(pool());
}
export type Database = Pick<
  ReturnType<typeof db>,
  'select' | 'insert' | 'update' | 'delete' | 'execute' | 'transaction'
>;
