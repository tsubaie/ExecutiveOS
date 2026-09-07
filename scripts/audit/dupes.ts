import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { exists } from './lib/files';
import { changedSince } from './lib/git';
import { report, finish, type Report } from './lib/report';
const run = promisify(execFile);
const Location = z.object({ name: z.string(), start: z.number(), end: z.number() });
const Duplicates = z.object({
  duplicates: z.array(z.object({ firstFile: Location, secondFile: Location, lines: z.number() })),
});
export type Duplicate = z.infer<typeof Duplicates>['duplicates'][number];
export async function findDuplicates(root: string, paths: string[]): Promise<Duplicate[]> {
  if (!paths.length) return [];
  const out = await mkdtemp(join(tmpdir(), 'jscpd-'));
  try {
    await run(
      join(root, 'node_modules/.bin/jscpd'),
      [
        ...paths,
        '--reporters',
        'json',
        '--output',
        out,
        '--min-lines',
        '10',
        '--min-tokens',
        '50',
        '--format',
        'typescript,tsx',
        '--silent',
      ],
      { cwd: root },
    ).catch((error) => {
      const failed = z.object({ code: z.number().optional() }).safeParse(error);
      if (!failed.success) throw error;
    });
    const path = join(out, 'jscpd-report.json');
    if (!(await exists(path))) return [];
    return Duplicates.parse(JSON.parse(await readFile(path, 'utf8'))).duplicates;
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}
export function evaluateDuplicates(duplicates: Duplicate[]): Report {
  const result = report('audit:dupes');
  for (const item of duplicates)
    result.violations.push({
      rule: 'duplicate-block',
      file: `${item.firstFile.name}:${item.firstFile.start}`,
      message: `${item.lines} lines duplicated at ${item.secondFile.name}:${item.secondFile.start}`,
    });
  return result;
}
export async function auditDupes(root: string, all: boolean) {
  const changed = all ? null : changedSince(root, 'main');
  const paths =
    changed === null
      ? ['src']
      : changed.filter((file) => /^src\/.*\.tsx?$/u.test(file) && !/\.(?:test|spec)\./u.test(file));
  const present: string[] = [];
  for (const path of paths) if (await exists(join(root, path))) present.push(path);
  return evaluateDuplicates(await findDuplicates(root, present));
}
if (process.argv[1]?.endsWith('dupes.ts'))
  finish(await auditDupes(process.cwd(), process.argv.includes('--all')));
