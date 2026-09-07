import 'server-only';
import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { create } from 'tar';
import { env } from '@/core/config/env';
import { postgresConnection } from '@/core/config/backup-env';
import { resolveInside } from '@/core/files/storage';
import { checksum, verifyBackup } from './manifest';
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
export async function createBackup(backupId: string, signal?: AbortSignal) {
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
  await mkdir(env().FILES_DIR, { recursive: true });
  await pgCommand(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', join(staging, 'db.dump')],
    signal,
  );
  await create({ cwd: env().FILES_DIR, file: join(staging, 'files.tar'), portable: true }, ['.']);
  const entries = await Promise.all(
    ['db.dump', 'files.tar'].map(async (name) => [
      name,
      {
        sha256: await checksum(join(staging, name)),
        bytes: (await stat(join(staging, name))).size,
      },
    ]),
  );
  const manifest = {
    id: backupId,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    appVersion: '0.1.0',
    files: Object.fromEntries(entries),
  };
  await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await verifyBackup(staging);
  signal?.throwIfAborted();
  await rename(staging, directory);
  return manifest;
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
