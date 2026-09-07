import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateDocs, layoutPaths, parseAdrIndex, scanTestNames } from '../docs';
import { evaluateModuleTests, evaluateTests, scanTestSource } from '../tests';
import { parseSpec } from '../lib/specs';
const fixture = (path: string) => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
describe('audit:docs', () => {
  it('rejects missing headers and sections, uncovered implemented IDs, unknown IDs and ADR drift', async () => {
    const spec = parseSpec('docs/features/bad.md', await readFile(fixture('docs/bad.md'), 'utf8'));
    const tests = scanTestNames(
      'x.test.ts',
      "it('BAD-B01 works', () => {});\ntest(`ZZZ-B09 ${locale}`, () => {});",
    );
    const adr = {
      index: parseAdrIndex(await readFile(fixture('docs/adr-index.md'), 'utf8')),
      files: [
        { number: '0001', status: 'accepted', editedBeyondStatus: true },
        { number: '0002', status: 'superseded', editedBeyondStatus: false },
        { number: '0003', status: 'accepted', editedBeyondStatus: false },
      ],
    };
    const result = evaluateDocs([spec], tests, [{ file: 'src/a.ts', id: 'BAD-B07' }], adr);
    const seen = result.violations.map((v) => `${v.rule}:${v.message}`);
    expect(seen).toEqual(
      expect.arrayContaining([
        'spec-header:missing **Implementation verified:**',
        'spec-section:missing ## Required scenarios',
        'requirement-coverage:no scenario names BAD-A01, BAD-B02',
        'unknown-requirement:ZZZ-B09 is not in any spec',
        'unknown-requirement:BAD-B07 is not in any spec',
        'adr-immutable:accepted ADR body changed after acceptance',
        'adr-index:not listed in docs/adr/README.md',
        'adr-index:listed in README but file missing',
      ]),
    );
  });
  it('downgrades coverage gaps to warnings for accepted specs', () => {
    const spec = parseSpec(
      'docs/features/ok.md',
      '**Status:** accepted\n**Spec reviewed:** x\n**Implementation verified:** not yet\n**Owner module:** `src/modules/ok`\n## Purpose\n## Acceptance criteria\n- OK-A01\n## Required scenarios\n',
    );
    const result = evaluateDocs([spec], [], [], { index: [], files: [] });
    expect(result.violations).toEqual([]);
    expect(result.warnings.map((w) => w.rule)).toEqual(['requirement-coverage']);
  });
  it('reads file paths out of the repository layout tree', () => {
    const doc =
      '## Repository layout\n\n```\n.\n├── docs/\n├── src/\n│   ├── core/\n│   │   ├── db/                    client.ts, migrate.ts\n│   └── ui/\n│       ├── primitives/  entity/\n└── package.json\n```\n';
    expect(layoutPaths(doc)).toEqual([
      'docs/',
      'package.json',
      'src/',
      'src/core/',
      'src/core/db/',
      'src/core/db/client.ts',
      'src/core/db/migrate.ts',
      'src/ui/',
      'src/ui/entity/',
      'src/ui/primitives/',
    ]);
  });
});
describe('audit:tests', () => {
  it('rejects a module without scenarios, missing layers on implemented modules, file reads and unlinked skips', async () => {
    const text = await readFile(fixture('tests/reads-source.test.ts.txt'), 'utf8');
    const empty = evaluateModuleTests({
      name: 'empty',
      status: 'accepted',
      testFiles: [],
      uiTests: 0,
      e2e: false,
      mutationTargets: false,
    });
    expect(empty.violations.map((v) => v.rule)).toEqual(['module-scenarios']);
    expect(empty.warnings.map((w) => w.rule)).toEqual(['module-layers']);
    const done = evaluateModuleTests({
      name: 'done',
      status: 'implemented',
      testFiles: ['service.test.ts'],
      uiTests: 0,
      e2e: true,
      mutationTargets: true,
    });
    expect(done.violations[0]?.message).toBe(
      'missing schema.test.ts, repo.test.ts, constraints.test.ts, api.test.ts, ui/*.test.tsx',
    );
    const sources = scanTestSource('src/x.test.ts', text);
    expect(sources.map((f) => `${f.rule}@${f.file}`)).toEqual([
      'test-reads-files@src/x.test.ts:1',
      'test-skipped@src/x.test.ts:2',
    ]);
    expect(
      evaluateTests([], [{ file: 'ok.test.ts', text: "it('TASKS-B01 x', () => {});" }]).violations,
    ).toEqual([]);
  });
});
