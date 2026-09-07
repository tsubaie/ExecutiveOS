import { join } from 'node:path';
import { read, tracked } from './lib/files';
import { report, finish, type Finding } from './lib/report';
const patterns: { rule: string; pattern: RegExp }[] = [
  { rule: 'personal-path', pattern: /\/(?:Users|home)\/[\w.-]+\//u },
  {
    rule: 'timezone-literal',
    pattern:
      /\b(?:Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Z][A-Za-z_]+/u,
  },
  { rule: 'locale-literal', pattern: /['"][a-z]{2}-[A-Z]{2}['"]/u },
];
const allowed = [
  /^src\/core\/config\//u,
  /^tests\/fixtures\//u,
  /^e2e\/fixtures\//u,
  /^scripts\/db\/seed\.ts$/u,
  /^scripts\/audit\/(?:portability(?:\.ts|-denylist\.txt)|tests\/)/u,
];
const scanned =
  /^(?:src|scripts|e2e|tools|tests|\.github)\/.*\.(?:[cm]?[jt]sx?|json|ya?ml|css|txt)$/u;
export function parseDenylist(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith('#'));
}
export function scanText(file: string, text: string, denylist: string[]): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const token of denylist)
      if (lower.includes(token))
        findings.push({
          rule: 'denylist',
          file: `${file}:${index + 1}`,
          message: `contains "${token}"`,
        });
    for (const { rule, pattern } of patterns) {
      const match = line.match(pattern);
      if (match)
        findings.push({ rule, file: `${file}:${index + 1}`, message: `contains ${match[0]}` });
    }
  });
  return findings;
}
export function isScanned(file: string) {
  return scanned.test(file) && !allowed.some((pattern) => pattern.test(file));
}
export async function auditPortability(root: string) {
  const result = report('audit:portability');
  const denylist = parseDenylist(await read(join(root, 'scripts/audit/portability-denylist.txt')));
  for (const file of tracked(root).filter(isScanned))
    result.violations.push(...scanText(file, await read(join(root, file)), denylist));
  return result;
}
if (process.argv[1]?.endsWith('portability.ts')) finish(await auditPortability(process.cwd()));
