import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  Exceptions,
  evaluateAdvisories,
  evaluateConcerns,
  evaluateKnip,
  evaluateVersions,
} from '../deps';
import { evaluateDuplicates, findDuplicates } from '../dupes';
import { installHint, parseReport, scanSecrets } from '../secrets';
const fixture = (path: string) => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
const Package = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({}),
});
describe('audit:deps', () => {
  it('rejects ranges, duplicate concerns, knip findings and unexcepted high advisories', async () => {
    const pkg = Package.parse(JSON.parse(await readFile(fixture('deps/package.json'), 'utf8')));
    expect(
      evaluateVersions(pkg)
        .map((f) => f.file)
        .sort(),
    ).toEqual(['react', 'vitest']);
    expect(evaluateConcerns(pkg)).toEqual([
      { rule: 'one-library-per-concern', file: 'date', message: '@js-temporal/polyfill, dayjs' },
    ]);
    expect(
      evaluateKnip(await readFile(fixture('deps/knip.json'), 'utf8')).map((f) => f.rule),
    ).toEqual(['knip-files', 'knip-devDependencies', 'knip-exports']);
    const audit = await readFile(fixture('deps/audit.json'), 'utf8');
    const exceptions = Exceptions.parse([
      { id: 3, expires: '2030-01-01', reason: 'no fix released' },
    ]);
    expect(evaluateAdvisories(audit, exceptions, '2026-09-07').map((f) => f.file)).toEqual([
      'leftpad',
    ]);
    expect(
      evaluateAdvisories(audit, [{ id: 1, expires: '2020-01-01', reason: 'x' }], '2026-09-07').map(
        (f) => f.file,
      ),
    ).toEqual(['leftpad', 'old']);
    expect(evaluateAdvisories(audit, exceptions, '2026-09-07')[0]?.message).toContain('high');
  });
});
describe('audit:dupes', () => {
  it('finds a block copied between two files and reports it once', async () => {
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    const duplicates = await findDuplicates(root, ['scripts/audit/tests/fixtures/dupes']);
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
    const result = evaluateDuplicates(duplicates);
    expect(result.violations[0]?.rule).toBe('duplicate-block');
    expect(evaluateDuplicates([]).violations).toEqual([]);
  });
});
describe('audit:secrets', () => {
  it('parses gitleaks findings and reports a missing binary with an install hint', async () => {
    const findings = parseReport(await readFile(fixture('secrets/report.json'), 'utf8'));
    expect(findings.map((f) => f.file)).toEqual(['src/config.ts:4', '.env:1']);
    expect(findings[0]?.message).toBe('in commit abcdef12');
    const missing = await scanSecrets('.', async () => ({ code: 0, stderr: '', missing: true }));
    expect(missing.violations).toEqual([{ rule: 'gitleaks-missing', message: installHint }]);
    const clean = await scanSecrets('.', async () => ({ code: 0, stderr: '', missing: false }));
    expect(clean.violations).toEqual([]);
    const failed = await scanSecrets('.', async () => ({
      code: 1,
      stderr: 'boom',
      missing: false,
    }));
    expect(failed.violations[0]?.rule).toBe('gitleaks-failed');
  });
});
