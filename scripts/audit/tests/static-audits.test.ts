import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  collectModule,
  evaluateModule,
  evaluateTopLevel,
  parseManifest,
  parseTopLevel,
} from '../structure';
import { argumentNames, evaluate as evaluateI18n, scanUsages } from '../i18n';
import { isScanned, parseDenylist, scanText } from '../portability';
import { parseSpec } from '../lib/specs';
const fixture = (path: string) => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
const rules = (findings: { rule: string; message: string }[]) =>
  findings.map((f) => `${f.rule}:${f.message}`);
describe('audit:structure', () => {
  it('rejects a module with an unlisted file and no tests, and accepts a complete one', async () => {
    const doc = await readFile(fixture('structure/docs/02-architecture.md'), 'utf8');
    const manifest = parseManifest(doc);
    expect(manifest.find((row) => row.entry === 'tests')?.required).toBe(true);
    const root = fixture('structure');
    const spec = parseSpec(
      'docs/features/good.md',
      await readFile(fixture('structure/docs/features/good.md'), 'utf8'),
    );
    const bad = evaluateModule(await collectModule(root, 'bad', [spec]), manifest);
    expect(rules(bad)).toEqual(
      expect.arrayContaining([
        'module-manifest:missing required tests',
        'module-manifest:unlisted entry helpers.ts',
        'module-spec:no feature spec',
        'module-manifest:schema/index.ts re-exports db.ts without server-only',
      ]),
    );
    expect(evaluateModule(await collectModule(root, 'good', [spec]), manifest)).toEqual([]);
  });
  it('rejects a top-level entry that is not in the repository layout', async () => {
    const allowed = parseTopLevel(
      await readFile(fixture('structure/docs/02-architecture.md'), 'utf8'),
    );
    expect(allowed.has('docs/')).toBe(true);
    expect(allowed.has('AGENTS.md')).toBe(true);
    expect(rules(evaluateTopLevel(['docs/x.md', 'stray.txt', 'notes/a.md'], allowed))).toEqual([
      'top-level-entry:not in the repository layout',
      'top-level-entry:not in the repository layout',
    ]);
  });
});
describe('audit:i18n', () => {
  const Catalog = z.record(z.string(), z.record(z.string(), z.string()));
  it('rejects missing keys, invalid ICU, argument drift and unresolved usages', async () => {
    const en = Catalog.parse(JSON.parse(await readFile(fixture('i18n/en.json'), 'utf8')));
    const ar = Catalog.parse(JSON.parse(await readFile(fixture('i18n/ar.json'), 'utf8')));
    const usages = scanUsages(
      'Component.tsx',
      await readFile(fixture('i18n/Component.tsx'), 'utf8'),
    );
    const result = evaluateI18n(en, ar, usages);
    const seen = result.violations.map((v) => `${v.rule}:${v.file}`);
    expect(seen).toEqual(
      expect.arrayContaining([
        'catalog-parity:common.onlyEn',
        'catalog-parity:common.onlyAr',
        'icu-syntax:en:common.broken',
        'icu-arguments:common.hello',
        'unresolved-key:Component.tsx',
      ]),
    );
    expect(result.warnings.filter((w) => w.rule === 'dynamic-key')).toEqual([
      {
        rule: 'dynamic-key',
        file: 'Component.tsx',
        message: '2 dynamic key(s) not statically checked',
      },
    ]);
    expect(argumentNames('{count, plural, one {# item} other {# items}} for {name}')).toEqual([
      'count',
      'name',
    ]);
  });
  it('accepts matching catalogs', () => {
    const en = { common: { hello: 'Hello {name}' } };
    expect(
      evaluateI18n(en, { common: { hello: 'مرحبا {name}' } }, [
        { file: 'a', namespace: 'common', key: 'hello' },
      ]).violations,
    ).toEqual([]);
  });
});
describe('audit:portability', () => {
  it('rejects timezone, locale, personal path and denylist literals outside allowed locations', async () => {
    const text = await readFile(fixture('portability/bad.ts'), 'utf8');
    const findings = scanText('src/x.ts', text, parseDenylist('# comment\npersonname\n'));
    expect(findings.map((f) => f.rule).sort()).toEqual([
      'denylist',
      'locale-literal',
      'personal-path',
      'timezone-literal',
    ]);
    expect(scanText('src/x.ts', "redirect('/home')", [])).toEqual([]);
    expect(isScanned('src/core/config/defaults.ts')).toBe(false);
    expect(isScanned('tests/fixtures/timezones.ts')).toBe(false);
    expect(isScanned('src/modules/tasks/service.ts')).toBe(true);
  });
});
