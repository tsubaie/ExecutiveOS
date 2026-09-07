import 'server-only';
import { mkdir, writeFile, rename, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '@/core/config/env';
export interface Storage {
  put(bytes: Uint8Array): Promise<{ key: string; sha256: string; size: number }>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export function resolveInside(root: string, key: string) {
  const path = resolve(root, key);
  if (!path.startsWith(resolve(root) + sep)) throw new Error('Path outside storage');
  return path;
}
export class LocalStorage implements Storage {
  async put(bytes: Uint8Array) {
    const root = env().FILES_DIR;
    await mkdir(root, { recursive: true });
    const key = createHash('sha256').update(bytes).digest('hex');
    const temp = join(root, `.upload-${randomUUID()}`);
    await writeFile(temp, bytes, { flag: 'wx' });
    await rename(temp, resolveInside(root, key));
    return { key, sha256: key, size: bytes.length };
  }
  read(key: string) {
    return readFile(resolveInside(env().FILES_DIR, key));
  }
  remove(key: string) {
    return unlink(resolveInside(env().FILES_DIR, key));
  }
}
export async function storageUsage() {
  const root = env().FILES_DIR;
  await mkdir(root, { recursive: true });
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (entry.isFile()) total += (await stat(join(root, entry.name))).size;
  return total;
}
export async function orphanSweep(
  referenced: Set<string>,
  olderThan = new Date(Date.now() - 86400000),
) {
  const root = env().FILES_DIR;
  await mkdir(root, { recursive: true });
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (
      entry.isFile() &&
      !referenced.has(entry.name) &&
      (await stat(join(root, entry.name))).mtime < olderThan
    )
      await unlink(join(root, entry.name));
}
