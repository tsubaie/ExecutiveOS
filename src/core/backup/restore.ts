import 'server-only';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { env } from '@/core/config/env';
import { pgCommand } from './pg';
import { verifyBackup } from './manifest';
import { maintenanceFile } from './maintenance';
import { extractBounded } from './extract';
import { clearStaleStaging, stagingPrefix, swapInto } from './swap';
// Resource limits for a restore (docs/02-architecture.md § Resource limits). Expanded bytes are
// further capped by FILES_QUOTA_GB and by the archive's own verified size.
export const restoreLimits = { maxEntries: 200_000, deadlineMs: 60 * 60 * 1000 };
export type RestoreOptions = {
  confirmed: boolean;
  signal?: AbortSignal;
  limits?: Partial<typeof restoreLimits>;
};
const restoreArgs = [
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-acl',
  '--single-transaction',
  '--exit-on-error',
];
/**
 * ADMIN-B31 the database is restored before any live file changes, and files are swapped in only
 * after pg_restore commits; maintenance mode is cleared on every exit.
 * ADMIN-B32 the archive's declared sizes are verified and extraction is bounded.
 * ADMIN-B33 every phase before the swap observes the caller's signal and the deadline.
 */
export async function restoreBackup(directory: string, options: RestoreOptions) {
  if (!options.confirmed) throw new Error('Restore replaces current data. Supply --confirm.');
  const limits = { ...restoreLimits, ...options.limits };
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(limits.deadlineMs),
  ]);
  const source = resolve(directory);
  const manifest = await verifyBackup(source, signal);
  const root = env().FILES_DIR;
  await mkdir(root, { recursive: true });
  await clearStaleStaging(root);
  const staging = join(root, `${stagingPrefix}${crypto.randomUUID()}`);
  const quota = env().FILES_QUOTA_GB * 1024 ** 3;
  await maintenanceFile(true);
  try {
    await mkdir(staging);
    await extractBounded(
      join(source, 'files.tar'),
      staging,
      {
        maxEntries: limits.maxEntries,
        maxBytes: Math.min(quota, manifest.files['files.tar'].bytes),
      },
      signal,
    );
    await pgCommand('pg_restore', [...restoreArgs, join(source, 'db.dump')], signal);
    // The database has committed; the swap is not abandoned half way on a late signal.
    await swapInto(root, staging);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await maintenanceFile(false);
  }
}
