import 'server-only';
import { z } from 'zod';
import { type Database } from '@/core/db/client';
import { aiClient } from './sdk';
import { connectionError } from './connection-error';
type Connection = {
  state: 'disabled' | 'enabled' | 'error';
  checkedAt: string | null;
  error: string | null;
};
const KeyStatus = z.object({ data: z.object({ limit_remaining: z.number().nullable() }) });
let connection: Connection = { state: 'disabled', checkedAt: null, error: null };
export function aiConnection() {
  return connection;
}
export function resetConnection() {
  connection = { state: 'disabled', checkedAt: null, error: null };
}
export async function checkConnection(database?: Database) {
  let error: string | null = null;
  try {
    const client = await aiClient(10_000, database);
    if (!client) {
      connection = { state: 'disabled', checkedAt: new Date().toISOString(), error: null };
      return connection;
    }
    // ADMIN-B23: the public model catalog cannot verify a key; this authenticated endpoint can.
    const raw: unknown = await client.get('/v1/key');
    const status = KeyStatus.parse(raw);
    if (status.data.limit_remaining !== null && status.data.limit_remaining <= 0) error = 'billing';
  } catch (cause) {
    error = connectionError(cause);
  }
  connection = {
    state: error ? 'error' : 'enabled',
    checkedAt: new Date().toISOString(),
    error,
  };
  return connection;
}
