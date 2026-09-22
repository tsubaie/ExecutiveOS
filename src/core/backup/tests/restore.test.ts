import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { restoreBackup } from '../restore';
import { maintenanceFile, isRestoring } from '../maintenance';
import { swapInto } from '../swap';
import { verifyBackup } from '../manifest';
import {
  appendTo,
  exists,
  makeBackup,
  names,
  rawTar,
  readTree,
  rewriteManifest,
  workspace,
  writeTree,
} from './fixtures/archive';
const config = vi.hoisted(() => ({ FILES_DIR: '', BACKUP_DIR: '', FILES_QUOTA_GB: 20 }));
const pg = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock('@/core/config/env', () => ({ env: () => config }));
vi.mock('../pg', () => ({ pgCommand: pg.command }));
let space: Awaited<ReturnType<typeof workspace>>;
const live = { 'old.txt': 'live', 'nested/keep.txt': 'live too' };
beforeEach(async () => {
  space = await workspace();
  Object.assign(config, { FILES_DIR: space.files, BACKUP_DIR: space.backups, FILES_QUOTA_GB: 20 });
  await writeTree(space.files, live);
  pg.command.mockReset().mockResolvedValue(undefined);
});
afterEach(() => space.dispose());
const source = () => join(space.root, 'source');
const good = () =>
  rawTar([
    { name: './', type: '5' },
    { name: './new.txt', body: 'restored' },
  ]);
async function expectUntouched() {
  expect(await readTree(space.files)).toEqual(live);
  expect(await names(space.files)).toEqual(['nested', 'old.txt']);
  expect(await isRestoring()).toBe(false);
}
describe('restore sequence', () => {
  it('ADMIN-B31 swaps files in only after pg_restore commits, and leaves no workspace behind', async () => {
    await makeBackup(source(), good());
    let seenDuringRestore: Record<string, string> = {};
    pg.command.mockImplementation(async () => {
      seenDuringRestore = await readTree(space.files);
      expect(await isRestoring()).toBe(true);
    });
    await restoreBackup(source(), { confirmed: true });
    expect(pg.command).toHaveBeenCalledWith(
      'pg_restore',
      expect.arrayContaining(['--single-transaction']),
      expect.any(AbortSignal),
    );
    expect(seenDuringRestore['old.txt']).toBe('live');
    expect(Object.values(seenDuringRestore)).toContain('restored');
    expect(await readTree(space.files)).toEqual({ 'new.txt': 'restored' });
    expect(await names(space.files)).toEqual(['new.txt']);
    expect(await isRestoring()).toBe(false);
  });
  it('ADMIN-B31 a pg_restore failure leaves live files untouched and clears maintenance', async () => {
    await makeBackup(source(), good());
    pg.command.mockRejectedValue(new Error('pg_restore failed (1)'));
    await expect(restoreBackup(source(), { confirmed: true })).rejects.toThrow('pg_restore failed');
    await expectUntouched();
  });
  it('ADMIN-B31 refuses without confirmation and clears maintenance idempotently', async () => {
    await makeBackup(source(), good());
    await expect(restoreBackup(source(), { confirmed: false })).rejects.toThrow('--confirm');
    await maintenanceFile(false);
    await maintenanceFile(false);
    await expectUntouched();
  });
  it('ADMIN-B31 a failed swap moves every live file back', async () => {
    await expect(swapInto(space.files, join(space.files, '.restore-missing'))).rejects.toThrow();
    expect(await readTree(space.files)).toEqual(live);
    expect(await names(space.files)).toEqual(['nested', 'old.txt']);
  });
  it('ADMIN-B31 a stale staging directory from an interrupted restore is cleared', async () => {
    await writeTree(space.files, { '.restore-stale/leftover.txt': 'x' });
    await makeBackup(source(), good());
    await restoreBackup(source(), { confirmed: true });
    expect(await names(space.files)).toEqual(['new.txt']);
  });
});
describe('archive validation and limits', () => {
  const refused: [string, Buffer, RegExp][] = [
    [
      'a path escaping the staging directory',
      rawTar([{ name: '../escape.txt', body: 'x' }]),
      /\.\./u,
    ],
    ['an absolute path', rawTar([{ name: '/tmp/absolute.txt', body: 'x' }]), /absolute|\//u],
    [
      'a symbolic link',
      rawTar([{ name: 'link', type: '2', linkname: '/etc/passwd' }]),
      /SymbolicLink/u,
    ],
    ['a hard link', rawTar([{ name: 'hard', type: '1', linkname: 'old.txt' }]), /Link/u],
    [
      'a truncated entry declaring more bytes than it holds',
      rawTar([{ name: 'big.bin', body: 'short', declaredSize: 4096 }]),
      /./u,
    ],
  ];
  it.each(refused)('ADMIN-B32 refuses %s and changes nothing', async (_label, archive, message) => {
    await makeBackup(source(), archive);
    await expect(restoreBackup(source(), { confirmed: true })).rejects.toThrow(message);
    expect(pg.command).not.toHaveBeenCalled();
    await expectUntouched();
    expect(await exists(join(space.root, 'escape.txt'))).toBe(false);
  });
  it('ADMIN-B32 stops at the entry-count limit', async () => {
    const many = rawTar(['a', 'b', 'c', 'd'].map((name) => ({ name, body: name })));
    await makeBackup(source(), many);
    await expect(
      restoreBackup(source(), { confirmed: true, limits: { maxEntries: 2 } }),
    ).rejects.toThrow('too many entries');
    await expectUntouched();
  });
  it('ADMIN-B32 stops when expanded bytes exceed the storage quota', async () => {
    config.FILES_QUOTA_GB = 100 / 1024 ** 3;
    await makeBackup(source(), rawTar([{ name: 'large.bin', body: 'x'.repeat(500) }]));
    await expect(restoreBackup(source(), { confirmed: true })).rejects.toThrow(
      'beyond the allowed size',
    );
    await expectUntouched();
  });
  it('ADMIN-B32 an archive whose size differs from the manifest is refused before activation', async () => {
    await makeBackup(source(), good());
    await appendTo(join(source(), 'files.tar'), 'tail');
    await expect(verifyBackup(source())).rejects.toThrow('size mismatch');
    await rewriteManifest(source(), (value) => {
      const tar = value.files['files.tar'];
      if (tar) tar.bytes += 4;
    });
    await expect(verifyBackup(source())).rejects.toThrow('checksum mismatch');
    await expect(restoreBackup(source(), { confirmed: true })).rejects.toThrow('mismatch');
    await expectUntouched();
  });
});
describe('interruption', () => {
  it('ADMIN-B33 the deadline aborts a slow phase and restores nothing', async () => {
    await makeBackup(source(), good());
    pg.command.mockImplementation(
      (_binary: string, _args: string[], signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    await expect(
      restoreBackup(source(), { confirmed: true, limits: { deadlineMs: 50 } }),
    ).rejects.toThrow();
    await expectUntouched();
  });
  it('ADMIN-B33 an aborted caller signal stops the restore before any change', async () => {
    await makeBackup(source(), good());
    const controller = new AbortController();
    controller.abort(new Error('Restore interrupted by SIGINT'));
    await expect(
      restoreBackup(source(), { confirmed: true, signal: controller.signal }),
    ).rejects.toThrow();
    expect(pg.command).not.toHaveBeenCalled();
    await expectUntouched();
  });
});
