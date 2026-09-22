// Filesystem helpers for the backup suites. Tests may not import node:fs themselves (audit:tests),
// so every temp-directory and archive operation they need lives here.
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { list } from 'tar';
export type RawEntry = {
  name: string;
  body?: string;
  type?: '0' | '1' | '2' | '5';
  linkname?: string;
  declaredSize?: number;
};
function header(entry: RawEntry, size: number) {
  const block = Buffer.alloc(512);
  block.write(entry.name, 0, 100, 'utf8');
  block.write(entry.type === '5' ? '0000755\0' : '0000644\0', 100);
  block.write('0000000\0', 108);
  block.write('0000000\0', 116);
  block.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  block.write('00000000000\0', 136);
  block.write('        ', 148);
  block.write(entry.type ?? '0', 156);
  if (entry.linkname) block.write(entry.linkname, 157, 100, 'utf8');
  block.write('ustar\0', 257);
  block.write('00', 263);
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return block;
}
// A hand-built ustar archive, so adversarial entries need no tool that would refuse to write them.
export function rawTar(entries: RawEntry[]) {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    parts.push(header(entry, entry.declaredSize ?? body.length), body);
    parts.push(Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}
export async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'eos-backup-'));
  return {
    root,
    files: join(root, 'files'),
    backups: join(root, 'backups'),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}
export async function writeTree(root: string, tree: Record<string, string>) {
  for (const [path, body] of Object.entries(tree)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }
}
// Every file under root as path → content, directories included as names only.
export async function readTree(root: string): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true }))
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      tree[path.slice(root.length + 1)] = await readFile(path, 'utf8');
    }
  return tree;
}
export const names = (root: string) => readdir(root);
export async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
// A backup directory as dump.ts writes it, around the given archive bytes.
export async function makeBackup(directory: string, archive: Buffer, dump = 'dump') {
  await mkdir(directory, { recursive: true });
  const db = Buffer.from(dump);
  await writeFile(join(directory, 'files.tar'), archive);
  await writeFile(join(directory, 'db.dump'), db);
  const manifest = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    appVersion: 'test',
    files: {
      'db.dump': { sha256: sha(db), bytes: db.length },
      'files.tar': { sha256: sha(archive), bytes: archive.length },
    },
  };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}
export async function rewriteManifest(
  directory: string,
  edit: (value: { files: Record<string, { bytes: number; sha256: string }> }) => void,
) {
  const path = join(directory, 'manifest.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  edit(value);
  await writeFile(path, JSON.stringify(value));
}
export async function appendTo(path: string, data: string) {
  await writeFile(path, data, { flag: 'a' });
}
export async function archiveNames(file: string) {
  const found: string[] = [];
  await list({ file, onReadEntry: (entry) => found.push(entry.path) });
  return found;
}
export async function writeDumpAt(args: string[]) {
  const at = args.indexOf('--file');
  const file = at >= 0 ? args[at + 1] : undefined;
  if (file) await writeFile(file, 'dump');
}
