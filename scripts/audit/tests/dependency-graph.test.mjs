import { describe, expect, it } from 'vitest';
import { cruise } from 'dependency-cruiser';
import { fileURLToPath } from 'node:url';
import config from '../../../.dependency-cruiser.cjs';

describe('WI-0001-M1 dependency boundary fixtures', () => {
  it('rejects a UI-to-server dependency hidden behind a barrel', async () => {
    const baseDir = fileURLToPath(new URL('./fixtures/graph', import.meta.url));
    const result = await cruise(['src/ui/Leak.ts'], {
      baseDir,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
      outputType: 'json',
      tsPreCompilationDeps: true,
    });
    const graph = JSON.parse(result.output);
    expect(
      graph.summary.violations.some((v) => v.rule.name === 'client-ui-cannot-reach-server'),
    ).toBe(true);
  });
});
