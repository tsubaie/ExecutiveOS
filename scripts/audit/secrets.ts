import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { report, finish, type Finding, type Report } from './lib/report';
export type Outcome = { code: number; stderr: string; missing: boolean };
export type Runner = (file: string, args: string[]) => Promise<Outcome>;
const Findings = z.array(
  z.object({
    RuleID: z.string(),
    File: z.string(),
    StartLine: z.number(),
    Commit: z.string().default(''),
  }),
);
export const installHint =
  'gitleaks is not installed. CI installs it; locally see https://github.com/gitleaks/gitleaks#installing';
export function parseReport(json: string): Finding[] {
  return Findings.parse(JSON.parse(json || '[]')).map((item) => ({
    rule: `secret:${item.RuleID}`,
    file: `${item.File}:${item.StartLine}`,
    message: item.Commit ? `in commit ${item.Commit.slice(0, 8)}` : 'in the working tree',
  }));
}
export const execRunner: Runner = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, (error, _stdout, stderr) => {
      if (!error) return resolve({ code: 0, stderr, missing: false });
      const failed = z
        .object({ code: z.union([z.number(), z.string()]).optional() })
        .safeParse(error);
      const code = failed.success ? failed.data.code : undefined;
      resolve({ code: typeof code === 'number' ? code : 1, stderr, missing: code === 'ENOENT' });
    });
  });
export async function scanSecrets(root: string, runner: Runner): Promise<Report> {
  const result = report('audit:secrets');
  const out = await mkdtemp(join(tmpdir(), 'gitleaks-'));
  const reportPath = join(out, 'report.json');
  try {
    const outcome = await runner('gitleaks', [
      'detect',
      '--source',
      root,
      '--report-format',
      'json',
      '--report-path',
      reportPath,
      '--log-opts=--all',
      '--no-banner',
      '--exit-code',
      '2',
    ]);
    if (outcome.missing) result.violations.push({ rule: 'gitleaks-missing', message: installHint });
    else if (outcome.code === 2)
      result.violations.push(...parseReport(await readFile(reportPath, 'utf8')));
    else if (outcome.code !== 0)
      result.violations.push({
        rule: 'gitleaks-failed',
        message: outcome.stderr.trim().slice(-500),
      });
  } finally {
    await rm(out, { recursive: true, force: true });
  }
  return result;
}
if (process.argv[1]?.endsWith('secrets.ts')) finish(await scanSecrets(process.cwd(), execRunner));
