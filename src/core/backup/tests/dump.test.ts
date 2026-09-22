import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { createBackup } from '../dump';
import { restoreBackup } from '../restore';
import {
  archiveNames,
  names,
  readTree,
  workspace,
  writeDumpAt,
  writeTree,
} from './fixtures/archive';
const config = vi.hoisted(() => ({ FILES_DIR: '', BACKUP_DIR: '', FILES_QUOTA_GB: 20 }));
const pg = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock('@/core/config/env', () => ({ env: () => config }));
vi.mock('../pg', () => ({ pgCommand: pg.command }));
let space: Awaited<ReturnType<typeof workspace>>;
beforeEach(async () => {
  space = await workspace();
  Object.assign(config, { FILES_DIR: space.files, BACKUP_DIR: space.backups });
  await writeTree(space.files, { 'doc.txt': 'document', '.restore-inflight/leak.txt': 'staged' });
  pg.command.mockReset().mockImplementation((_binary: string, args: string[]) => writeDumpAt(args));
});
afterEach(() => space.dispose());
it('ADMIN-B33 an aborted backup leaves no staging directory behind', async () => {
  const controller = new AbortController();
  pg.command.mockImplementation(async (_binary: string, args: string[]) => {
    await writeDumpAt(args);
    controller.abort(new Error('shutdown'));
  });
  const id = crypto.randomUUID();
  await expect(createBackup(id, controller.signal)).rejects.toThrow();
  expect(await names(space.backups)).toEqual([]);
});
it('ADMIN-B31 a backup never captures a restore workspace, and restores round-trip', async () => {
  const id = crypto.randomUUID();
  await createBackup(id);
  const entries = await archiveNames(join(space.backups, id, 'files.tar'));
  expect(entries.some((name) => name.endsWith('doc.txt'))).toBe(true);
  expect(entries.some((name) => name.includes('.restore-'))).toBe(false);
  await writeTree(space.files, { 'later.txt': 'written after the backup' });
  await restoreBackup(join(space.backups, id), { confirmed: true });
  expect(await readTree(space.files)).toEqual({ 'doc.txt': 'document' });
});
