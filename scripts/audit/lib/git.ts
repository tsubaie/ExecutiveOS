import { execFileSync } from 'node:child_process';
export function git(root: string, args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
export function changedSince(root: string, base: string) {
  try {
    const merge = git(root, ['merge-base', base, 'HEAD']);
    return git(root, ['diff', '--name-only', merge, 'HEAD']).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}
