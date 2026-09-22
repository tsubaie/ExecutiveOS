import 'server-only';
import { spawn } from 'node:child_process';
import { postgresConnection } from '@/core/config/backup-env';
// The only subprocess in the application (ADR 0008). Kept apart from dump and restore so the
// restore sequence can be exercised without a PostgreSQL server.
export function pgCommand(binary: 'pg_dump' | 'pg_restore', args: string[], signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const connection = postgresConnection();
    const child = spawn(binary, [...connection.args, ...args], {
      env: connection.environment,
      stdio: ['ignore', 'ignore', 'pipe'],
      ...(signal ? { signal } : {}),
    });
    let diagnostic = '';
    child.stderr.on('data', (chunk) => {
      diagnostic = (diagnostic + String(chunk)).slice(-4096);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${binary} failed (${code}): ${diagnostic}`));
    });
  });
}
