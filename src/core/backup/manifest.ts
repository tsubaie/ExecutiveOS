import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const Manifest = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  schemaVersion: z.number(),
  appVersion: z.string(),
  files: z.record(
    z.enum(['db.dump', 'files.tar']),
    z.object({ sha256: z.string(), bytes: z.number() }),
  ),
});
export async function checksum(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyBackup(directory: string) {
  const manifest = Manifest.parse(
    JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
  );
  for (const [name, value] of Object.entries(manifest.files))
    if ((await checksum(join(directory, name))) !== value.sha256)
      throw new Error('Backup checksum mismatch');
  return manifest;
}
