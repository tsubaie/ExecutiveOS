import 'server-only';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extract } from 'tar';
import { env } from '@/core/config/env';
import { pgCommand } from './dump';
import { verifyBackup } from './manifest';
import { maintenanceFile } from './maintenance';
export async function restoreBackup(directory: string, confirmed: boolean) {
  if (!confirmed) throw new Error('Restore replaces current data. Supply --confirm.');
  const source = resolve(directory);
  await verifyBackup(source);
  await maintenanceFile(true);
  await mkdir(env().FILES_DIR, { recursive: true });
  await extract({
    cwd: env().FILES_DIR,
    file: join(source, 'files.tar'),
    strict: true,
    preservePaths: false,
    filter: (_, entry) => 'type' in entry && entry.type !== 'SymbolicLink' && entry.type !== 'Link',
  });
  await pgCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--single-transaction',
    '--exit-on-error',
    join(source, 'db.dump'),
  ]);
  await verifyBackup(source);
  await maintenanceFile(false);
}
