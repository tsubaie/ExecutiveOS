import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
export const Manifest = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  schemaVersion: z.number(),
  appVersion: z.string(),
  files: z.record(
    z.enum(['db.dump', 'files.tar']),
    z.object({ sha256: z.string(), bytes: z.number().int().nonnegative() }),
  ),
});
export async function checksum(path: string, signal?: AbortSignal) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path, signal ? { signal } : {})) hash.update(chunk);
  return hash.digest('hex');
}
// ADMIN-B32: the declared size is checked before the checksum, so a file that grew or shrank is
// refused without hashing it, and restore can trust `bytes` as the ceiling for extraction.
export async function verifyBackup(directory: string, signal?: AbortSignal) {
  const manifest = Manifest.parse(
    JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
  );
  for (const [name, value] of Object.entries(manifest.files)) {
    const path = join(directory, name);
    if ((await stat(path)).size !== value.bytes) throw new Error('Backup size mismatch');
    if ((await checksum(path, signal)) !== value.sha256)
      throw new Error('Backup checksum mismatch');
  }
  return manifest;
}
