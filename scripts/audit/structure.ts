import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, read, tracked } from './lib/files';
import { report, finish, type Finding, type Report } from './lib/report';
import { loadSpecs, specForModule, type Spec } from './lib/specs';
export type ManifestRow = { entry: string; required: boolean };
export type ModuleInput = {
  name: string;
  entries: string[];
  schemaEntries: string[];
  hasSpec: boolean;
  jobsRegistered: boolean;
  schemaIndex: { reexportsDb: boolean; serverOnly: boolean } | null;
};
const schemaFiles = ['db.ts', 'validation.ts', 'index.ts'];
export function parseManifest(doc: string): ManifestRow[] {
  const start = doc.indexOf('### Module manifest');
  const end = doc.indexOf('\n## ', start);
  const rows: ManifestRow[] = [];
  for (const match of doc.slice(start, end).matchAll(/^\| `([^`]+)` \| ([^|]+) \|/gmu))
    rows.push({
      entry: (match[1] ?? '').replace(/\/$/u, ''),
      required: (match[2] ?? '').trim() === 'yes',
    });
  return rows;
}
export function parseTopLevel(doc: string) {
  const start = doc.indexOf('## Repository layout');
  const open = doc.indexOf('```', start) + 3;
  const block = doc.slice(open, doc.indexOf('```', open));
  const names = new Set<string>();
  for (const line of block.split('\n')) {
    const row = line.match(/^(?:├── |└── |\s{4})(\S.*)$/u);
    if (!row) continue;
    const head = (row[1] ?? '').split(/\s{3,}/u)[0] ?? '';
    for (const token of head.split(/\s+/u)) if (/^[\w.@-]+\/?$/u.test(token)) names.add(token);
  }
  return names;
}
function manifestFindings(input: ModuleInput, manifest: ManifestRow[]): Finding[] {
  const findings: Finding[] = [];
  const file = `src/modules/${input.name}`;
  const known = new Set(manifest.map((row) => row.entry.split('/')[0] ?? ''));
  for (const row of manifest.filter((row) => row.required))
    if (!has(input, row.entry))
      findings.push({ rule: 'module-manifest', file, message: `missing required ${row.entry}` });
  if (input.schemaEntries.includes('db.ts'))
    for (const entry of ['schema/index.ts', 'repo.ts'])
      if (!has(input, entry))
        findings.push({
          rule: 'module-manifest',
          file,
          message: `${entry} required with schema/db.ts`,
        });
  for (const entry of input.entries)
    if (!known.has(entry))
      findings.push({ rule: 'module-manifest', file, message: `unlisted entry ${entry}` });
  for (const entry of input.schemaEntries)
    if (!schemaFiles.includes(entry))
      findings.push({ rule: 'module-manifest', file, message: `unlisted entry schema/${entry}` });
  return findings;
}
export function evaluateModule(input: ModuleInput, manifest: ManifestRow[]): Finding[] {
  const findings = manifestFindings(input, manifest);
  const file = `src/modules/${input.name}`;
  if (!input.hasSpec) findings.push({ rule: 'module-spec', file, message: 'no feature spec' });
  if (input.entries.includes('jobs.ts') && !input.jobsRegistered)
    findings.push({ rule: 'module-jobs', file, message: 'jobs.ts is not registered' });
  if (input.schemaIndex?.reexportsDb && !input.schemaIndex.serverOnly)
    findings.push({
      rule: 'module-manifest',
      file,
      message: 'schema/index.ts re-exports db.ts without server-only',
    });
  return findings;
}
function has(input: ModuleInput, entry: string) {
  const [top, nested] = entry.split('/');
  if (nested) return input.entries.includes(top ?? '') && input.schemaEntries.includes(nested);
  return input.entries.includes(top ?? '');
}
export function evaluateTopLevel(files: string[], allowed: Set<string>): Finding[] {
  const seen = new Set(files.map((path) => (path.includes('/') ? `${path.split('/')[0]}/` : path)));
  return [...seen]
    .filter((entry) => !allowed.has(entry))
    .map((entry) => ({
      rule: 'top-level-entry',
      file: entry,
      message: 'not in the repository layout',
    }));
}
export async function collectModule(
  root: string,
  name: string,
  specs: Spec[],
): Promise<ModuleInput> {
  const dir = join(root, 'src/modules', name);
  const entries = (await readdir(dir)).sort();
  const schemaEntries = entries.includes('schema')
    ? (await readdir(join(dir, 'schema'))).sort()
    : [];
  const registry = (await exists(join(root, 'src/core/jobs/registry.ts')))
    ? await read(join(root, 'src/core/jobs/registry.ts'))
    : '';
  let schemaIndex: ModuleInput['schemaIndex'] = null;
  if (schemaEntries.includes('index.ts')) {
    const text = await read(join(dir, 'schema/index.ts'));
    schemaIndex = {
      reexportsDb: /from '\.\/db'/u.test(text),
      serverOnly: /'server-only'/u.test(text),
    };
  }
  return {
    name,
    entries,
    schemaEntries,
    hasSpec: Boolean(specForModule(specs, name)),
    jobsRegistered: registry.includes(`modules/${name}/jobs`),
    schemaIndex,
  };
}
export async function auditStructure(root: string): Promise<Report> {
  const result = report('audit:structure');
  const doc = await read(join(root, 'docs/02-architecture.md'));
  const manifest = parseManifest(doc);
  const specs = await loadSpecs(root);
  for (const name of (await readdir(join(root, 'src/modules'))).sort())
    result.violations.push(...evaluateModule(await collectModule(root, name, specs), manifest));
  result.violations.push(...evaluateTopLevel(tracked(root), parseTopLevel(doc)));
  return result;
}
if (process.argv[1]?.endsWith('structure.ts')) finish(await auditStructure(process.cwd()));
