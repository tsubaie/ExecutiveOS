import 'server-only';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile, rename, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { create } from 'tar';
import { env } from '@/core/config/env';
import { resolveInside } from '@/core/files/storage';
import { checksum, verifyBackup } from './manifest';
import { pgCommand } from './pg';
import { isRestoreWorkspace } from './swap';
import { appVersion } from '@/core/config/version';
// A restore in progress keeps its staging and retired directories inside FILES_DIR; they are
// never part of a backup.
function outsideRestoreWorkspace(path: string) {
  return !isRestoreWorkspace(path.replace(/^\.\//u, '').split('/')[0] ?? '');
}
async function writeBackup(backupId: string, staging: string, signal: AbortSignal) {
  await mkdir(env().FILES_DIR, { recursive: true });
  await pgCommand(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', join(staging, 'db.dump')],
    signal,
  );
  await pipeline(
    create({ cwd: env().FILES_DIR, portable: true, filter: outsideRestoreWorkspace }, ['.']),
    createWriteStream(join(staging, 'files.tar')),
    { signal },
  );
  const entries = await Promise.all(
    ['db.dump', 'files.tar'].map(async (name) => [
      name,
      {
        sha256: await checksum(join(staging, name), signal),
        bytes: (await stat(join(staging, name))).size,
      },
    ]),
  );
  const manifest = {
    id: backupId,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    appVersion,
    files: Object.fromEntries(entries),
  };
  await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { signal });
  await verifyBackup(staging, signal);
  signal.throwIfAborted();
  return manifest;
}
// ADMIN-B33: every phase observes the signal, and a backup that does not finish leaves no
// staging directory behind.
export async function createBackup(backupId: string, signal = new AbortController().signal) {
  const root = env().BACKUP_DIR;
  const directory = resolveInside(root, backupId);
  await mkdir(root, { recursive: true });
  try {
    const existing = await stat(directory);
    if (existing.isDirectory()) return await verifyBackup(directory);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  const staging = resolveInside(root, `.${backupId}-${crypto.randomUUID()}`);
  await mkdir(staging, { recursive: true });
  try {
    const manifest = await writeBackup(backupId, staging, signal);
    await rename(staging, directory);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
export async function listBackups() {
  const root = env().BACKUP_DIR;
  await mkdir(root, { recursive: true });
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      try {
        result.push(await verifyBackup(resolveInside(root, entry.name)));
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
