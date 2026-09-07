import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
const skipped = new Set(['node_modules', '.next', '.git', 'coverage', 'playwright-report']);
export async function walk(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (skipped.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(root, path)));
    else files.push(relative(root, path).split(sep).join('/'));
  }
  return files.sort();
}
export function tracked(root: string) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path && existsSync(join(root, path)));
}
export async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
export function read(path: string) {
  return readFile(path, 'utf8');
}
export function isTestSource(path: string) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path);
}
