import 'server-only';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
export const stagingPrefix = '.restore-';
const previousPrefix = '.previous-';
// Restore workspaces live inside FILES_DIR because it is normally a volume mount point: it
// cannot be renamed itself, and a rename is only atomic within one filesystem.
export function isRestoreWorkspace(name: string) {
  return name.startsWith(stagingPrefix) || name.startsWith(previousPrefix);
}
export async function clearStaleStaging(root: string) {
  for (const name of await readdir(root))
    if (name.startsWith(stagingPrefix))
      await rm(join(root, name), { recursive: true, force: true });
}
async function moveAll(from: string, to: string, names: string[], moved: string[]) {
  for (const name of names) {
    await rename(join(from, name), join(to, name));
    moved.push(name);
  }
}
// ADMIN-B31: live entries are retired into a sibling directory, staged entries take their place,
// and only then is the retired set removed. Any failure moves both sets back; if even that fails
// the retired directory is left in place so no live file is lost.
export async function swapInto(root: string, staging: string) {
  const previous = join(root, `${previousPrefix}${crypto.randomUUID()}`);
  await mkdir(previous);
  const retired: string[] = [];
  const placed: string[] = [];
  try {
    const live = (await readdir(root)).filter((name) => !isRestoreWorkspace(name));
    await moveAll(root, previous, live, retired);
    await moveAll(staging, root, await readdir(staging), placed);
  } catch (error) {
    try {
      await moveAll(root, staging, placed, []);
      await moveAll(previous, root, retired, []);
    } catch (rollback) {
      throw new AggregateError(
        [error, rollback],
        `File swap failed; previous files kept in ${previous}`,
      );
    }
    await rm(previous, { recursive: true, force: true });
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
}
