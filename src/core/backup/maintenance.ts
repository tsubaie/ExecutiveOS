import 'server-only';
import { access, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '@/core/config/env';
export async function isRestoring() {
  try {
    await access(join(env().BACKUP_DIR, '.maintenance'));
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}
export async function maintenanceFile(enabled: boolean) {
  await mkdir(env().BACKUP_DIR, { recursive: true });
  const file = join(env().BACKUP_DIR, '.maintenance');
  if (enabled) await writeFile(file, new Date().toISOString());
  else await unlink(file);
}
