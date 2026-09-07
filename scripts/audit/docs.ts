import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, read, tracked, isTestSource } from './lib/files';
import { git } from './lib/git';
import { report, finish, type Finding, type Report } from './lib/report';
import { idPattern, loadSpecs, type Spec } from './lib/specs';
export type TestName = { file: string; name: string };
export type AdrEntry = { number: string; status: string };
export type AdrFile = { number: string; status: string; editedBeyondStatus: boolean };
const requiredHeaders = ['Status', 'Spec reviewed', 'Implementation verified'];
const requiredSections = ['Purpose', 'Acceptance criteria', 'Required scenarios'];
const statuses = ['draft', 'accepted', 'implemented'];
export function scanTestNames(file: string, text: string): TestName[] {
  const names: TestName[] = [];
  for (const match of text.matchAll(
    /\b(?:it|test)(?:\.each\([^)]*\))?\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/gu,
  ))
    names.push({ file, name: match[1] ?? match[2] ?? match[3] ?? '' });
  return names;
}
function specFindings(
  spec: Spec,
  covered: Set<string>,
): { violations: Finding[]; warnings: Finding[] } {
  const violations: Finding[] = [];
  const warnings: Finding[] = [];
  for (const header of requiredHeaders)
    if (!(header in spec.headers))
      violations.push({ rule: 'spec-header', file: spec.file, message: `missing **${header}:**` });
  if (!('Owner module' in spec.headers || 'Owner modules' in spec.headers))
    violations.push({ rule: 'spec-header', file: spec.file, message: 'missing **Owner module:**' });
  if (!statuses.includes(spec.status))
    violations.push({
      rule: 'spec-header',
      file: spec.file,
      message: `unknown status "${spec.status}"`,
    });
  for (const section of requiredSections)
    if (!spec.sections.includes(section))
      violations.push({ rule: 'spec-section', file: spec.file, message: `missing ## ${section}` });
  const missing = [...spec.ids].filter((id) => /-[AB]\d{2}$/u.test(id) && !covered.has(id)).sort();
  if (missing.length) {
    const finding = {
      rule: 'requirement-coverage',
      file: spec.file,
      message: `no scenario names ${missing.join(', ')}`,
    };
    if (spec.status === 'implemented') violations.push(finding);
    else warnings.push(finding);
  }
  return { violations, warnings };
}
export function evaluateDocs(
  specs: Spec[],
  tests: TestName[],
  codeIds: { file: string; id: string }[],
  adr: { index: AdrEntry[]; files: AdrFile[] },
): Report {
  const result = report('audit:docs');
  const known = new Set(specs.flatMap((spec) => [...spec.ids]));
  const covered = new Set(
    tests.flatMap((test) => [...test.name.matchAll(idPattern)].map((m) => m[0])),
  );
  for (const spec of specs) {
    const findings = specFindings(spec, covered);
    result.violations.push(...findings.violations);
    result.warnings.push(...findings.warnings);
  }
  for (const test of tests)
    for (const match of test.name.matchAll(idPattern))
      if (!known.has(match[0]))
        result.violations.push({
          rule: 'unknown-requirement',
          file: test.file,
          message: `${match[0]} is not in any spec`,
        });
  for (const { file, id } of codeIds)
    if (!known.has(id))
      result.violations.push({
        rule: 'unknown-requirement',
        file,
        message: `${id} is not in any spec`,
      });
  result.violations.push(...adrFindings(adr));
  return result;
}
function adrFindings(adr: { index: AdrEntry[]; files: AdrFile[] }): Finding[] {
  const findings: Finding[] = [];
  const indexed = new Map(adr.index.map((entry) => [entry.number, entry.status]));
  for (const file of adr.files) {
    const status = indexed.get(file.number);
    if (status === undefined)
      findings.push({
        rule: 'adr-index',
        file: `docs/adr/${file.number}`,
        message: 'not listed in docs/adr/README.md',
      });
    else if (!status.startsWith(file.status))
      findings.push({
        rule: 'adr-index',
        file: `docs/adr/${file.number}`,
        message: `index says "${status}", file says "${file.status}"`,
      });
    if (file.status === 'accepted' && file.editedBeyondStatus)
      findings.push({
        rule: 'adr-immutable',
        file: `docs/adr/${file.number}`,
        message: 'accepted ADR body changed after acceptance',
      });
  }
  for (const entry of adr.index)
    if (!adr.files.some((file) => file.number === entry.number))
      findings.push({
        rule: 'adr-index',
        file: `docs/adr/${entry.number}`,
        message: 'listed in README but file missing',
      });
  return findings;
}
export function parseAdrIndex(text: string): AdrEntry[] {
  return [...text.matchAll(/^\| (\d{4}) \| [^|]+ \| ([^|]+) \|/gmu)].map((m) => ({
    number: m[1] ?? '',
    status: (m[2] ?? '').trim(),
  }));
}
function editedBeyondStatus(root: string, file: string) {
  if (!git(root, ['log', '--diff-filter=M', '--format=%H', '--', file])) return false;
  const first =
    git(root, ['log', '--diff-filter=A', '--format=%H', '--', file]).split('\n').at(-1) ?? '';
  const diff = git(root, ['diff', first, 'HEAD', '--', file]);
  return diff
    .split('\n')
    .filter((line) => /^[+-](?![+-]{2})/u.test(line))
    .some((line) => !/^[+-]\*\*Status:\*\*/u.test(line));
}
export async function collectAdr(root: string) {
  const dir = join(root, 'docs/adr');
  const index = parseAdrIndex(await read(join(dir, 'README.md')));
  const files: AdrFile[] = [];
  for (const name of (await readdir(dir)).filter((n) => /^\d{4}-.*\.md$/u.test(n)).sort()) {
    const text = await read(join(dir, name));
    const status = (text.match(/^\*\*Status:\*\*\s*(\w+)/mu)?.[1] ?? '').toLowerCase();
    files.push({
      number: name.slice(0, 4),
      status,
      editedBeyondStatus: editedBeyondStatus(root, `docs/adr/${name}`),
    });
  }
  return { index, files };
}
async function collectTests(root: string) {
  const tests: TestName[] = [];
  for (const file of tracked(root).filter(isTestSource))
    tests.push(...scanTestNames(file, await read(join(root, file))));
  return tests;
}
async function collectCodeIds(root: string) {
  const ids: { file: string; id: string }[] = [];
  for (const file of tracked(root).filter((f) => /^src\/.*\.tsx?$/u.test(f) && !isTestSource(f)))
    for (const match of (await read(join(root, file))).matchAll(/rule:\s*'([A-Z]+-[ABI]\d{2})'/gu))
      ids.push({ file, id: match[1] ?? '' });
  return ids;
}
function layoutRow(line: string) {
  const row = line.match(/^((?:│   |    )*)(?:├── |└── )(\S.*)$/u);
  if (!row) return null;
  const [head = '', ...rest] = (row[2] ?? '').split(/\s{3,}/u);
  const names = head.split(/\s+/u).filter((token) => /^[\w.@()-]+\/?$/u.test(token));
  const files = rest
    .join(' ')
    .split(/[\s,]+/u)
    .filter((token) => /^[\w.-]+\.(?:tsx?|json|css|mjs|cjs|ya?ml)$/u.test(token));
  return { depth: (row[1] ?? '').length / 4, names, files };
}
export function layoutPaths(doc: string) {
  const start = doc.indexOf('## Repository layout');
  const open = doc.indexOf('```', start) + 3;
  const stack: string[] = [];
  const paths = new Set<string>();
  for (const line of doc.slice(open, doc.indexOf('```', open)).split('\n')) {
    const row = layoutRow(line);
    if (!row) continue;
    stack.length = row.depth;
    const parent = stack.slice(0, row.depth).join('');
    for (const name of row.names) paths.add(parent + name);
    const single = row.names.length === 1 ? row.names[0] : undefined;
    if (single?.endsWith('/')) stack[row.depth] = single;
    for (const file of row.files) paths.add(parent + (row.names[0] ?? '') + file);
  }
  return [...paths].sort();
}
export async function writeStatus(root: string) {
  const rows: string[] = [];
  let present = 0;
  const paths = layoutPaths(await read(join(root, 'docs/02-architecture.md')));
  for (const path of paths) {
    const ok = await exists(join(root, path));
    if (ok) present += 1;
    rows.push(`| \`${path}\` | ${ok ? 'present' : 'planned'} |`);
  }
  const text = `# Implementation status\n\nGenerated by \`pnpm audit:docs --status\` from the repository layout in \`02-architecture.md\`. Do not edit by hand.\n\n${present} of ${paths.length} named entries exist.\n\n| Path | Status |\n|---|---|\n${rows.join('\n')}\n`;
  await writeFile(join(root, 'docs/STATUS.md'), text);
}
export async function auditDocs(root: string) {
  const specs = await loadSpecs(root);
  return evaluateDocs(
    specs,
    await collectTests(root),
    await collectCodeIds(root),
    await collectAdr(root),
  );
}
if (process.argv[1]?.endsWith('docs.ts')) {
  if (process.argv.includes('--status')) await writeStatus(process.cwd());
  finish(await auditDocs(process.cwd()));
}
