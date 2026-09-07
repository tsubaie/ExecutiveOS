import 'server-only';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { env } from '@/core/config/env';
export function resolveInside(root: string, key: string) {
  const path = resolve(root, key);
  if (!path.startsWith(resolve(root) + sep)) throw new Error('Path outside storage');
  return path;
}
export async function storageUsage() {
  const root = env().FILES_DIR;
  await mkdir(root, { recursive: true });
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (entry.isFile()) total += (await stat(join(root, entry.name))).size;
  return total;
}
