import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { read } from './lib/files';
import { report, finish, type Finding, type Report } from './lib/report';
const run = promisify(execFile);
const Package = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({}),
});
export type Package = z.infer<typeof Package>;
const KnipIssues = z.object({
  issues: z.array(
    z
      .object({ file: z.string() })
      .catchall(z.union([z.array(z.object({ name: z.string() })), z.string(), z.number()])),
  ),
});
const Advisories = z.object({
  advisories: z.record(
    z.string(),
    z.object({ id: z.number(), severity: z.string(), module_name: z.string(), url: z.string() }),
  ),
});
export const Exceptions = z.array(
  z.object({ id: z.number(), expires: z.iso.date(), reason: z.string().min(1) }),
);
const concerns: Record<string, string[]> = {
  date: ['@js-temporal/polyfill', 'dayjs', 'date-fns', 'luxon', 'moment'],
  chart: ['recharts', 'chart.js', 'victory', '@nivo/core', 'echarts'],
  markdown: ['react-markdown', 'marked', 'markdown-it', 'micromark'],
  http: ['axios', 'ky', 'got', 'node-fetch'],
};
const knipKeys = [
  'files',
  'dependencies',
  'devDependencies',
  'exports',
  'types',
  'unlisted',
  'unresolved',
  'duplicates',
  'binaries',
];
export function evaluateVersions(pkg: Package): Finding[] {
  const findings: Finding[] = [];
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }))
    if (!/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/u.test(version))
      findings.push({
        rule: 'inexact-version',
        file: name,
        message: `"${version}" is not an exact version`,
      });
  return findings;
}
export function evaluateConcerns(pkg: Package): Finding[] {
  const installed = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  const findings: Finding[] = [];
  for (const [concern, libraries] of Object.entries(concerns)) {
    const present = libraries.filter((name) => installed.has(name));
    if (present.length > 1)
      findings.push({
        rule: 'one-library-per-concern',
        file: concern,
        message: present.join(', '),
      });
  }
  return findings;
}
export function evaluateKnip(json: string): Finding[] {
  const findings: Finding[] = [];
  for (const issue of KnipIssues.parse(JSON.parse(json)).issues)
    for (const key of knipKeys) {
      const value = issue[key];
      if (Array.isArray(value) && value.length)
        findings.push({
          rule: `knip-${key}`,
          file: issue.file,
          message: value.map((item) => item.name).join(', '),
        });
    }
  return findings;
}
export function evaluateAdvisories(
  json: string,
  exceptions: z.infer<typeof Exceptions>,
  today: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const advisory of Object.values(Advisories.parse(JSON.parse(json)).advisories)) {
    if (!['high', 'critical'].includes(advisory.severity)) continue;
    const exception = exceptions.find((item) => item.id === advisory.id);
    if (!exception || exception.expires < today)
      findings.push({
        rule: 'vulnerable-dependency',
        file: advisory.module_name,
        message: `${advisory.severity} ${advisory.url}${exception ? ' (exception expired)' : ''}`,
      });
  }
  return findings;
}
async function output(file: string, args: string[], cwd: string) {
  try {
    return (await run(file, args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;
  } catch (error) {
    const failed = z.object({ stdout: z.string() }).safeParse(error);
    if (failed.success && failed.data.stdout) return failed.data.stdout;
    throw error;
  }
}
async function pnpmAudit(root: string) {
  try {
    return await output('pnpm', ['audit', '--json'], root);
  } catch {
    return output('corepack', ['pnpm', 'audit', '--json'], root);
  }
}
export async function auditDeps(root: string): Promise<Report> {
  const result = report('audit:deps');
  const pkg = Package.parse(JSON.parse(await read(join(root, 'package.json'))));
  result.violations.push(...evaluateVersions(pkg), ...evaluateConcerns(pkg));
  result.violations.push(
    ...evaluateKnip(
      await output(join(root, 'node_modules/.bin/knip'), ['--reporter', 'json'], root),
    ),
  );
  const exceptions = Exceptions.parse(
    JSON.parse(await read(join(root, 'scripts/audit/deps-exceptions.json'))),
  );
  try {
    result.violations.push(
      ...evaluateAdvisories(
        await pnpmAudit(root),
        exceptions,
        new Date().toISOString().slice(0, 10),
      ),
    );
  } catch (error) {
    result.violations.push({
      rule: 'pnpm-audit',
      message: `pnpm audit failed: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }
  return result;
}
if (process.argv[1]?.endsWith('deps.ts')) finish(await auditDeps(process.cwd()));
