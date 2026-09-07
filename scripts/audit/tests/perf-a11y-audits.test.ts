import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { evaluateAxe, pageRoutes } from '../a11y';
import { evaluatePerf, limits } from '../perf';
describe('audit:perf', () => {
  it('rejects golden paths over the time or query budget', () => {
    const result = evaluatePerf([
      { name: 'slow', ms: limits.ms + 1, queries: 2 },
      { name: 'chatty', ms: 10, queries: limits.queries + 1 },
      { name: 'fine', ms: 10, queries: limits.queries },
    ]);
    expect(result.violations.map((v) => `${v.rule}:${v.file}`)).toEqual([
      'server-time:slow',
      'query-budget:chatty',
    ]);
  });
});
describe('audit:a11y', () => {
  it('keeps only serious and critical axe violations and derives routes from app pages', async () => {
    const findings = evaluateAxe('/tasks', 'ar', [
      { id: 'label', impact: 'critical', nodes: 2 },
      { id: 'region', impact: 'moderate', nodes: 1 },
      { id: 'color-contrast', impact: 'serious', nodes: 3 },
    ]);
    expect(findings.map((f) => f.rule)).toEqual(['axe:label', 'axe:color-contrast']);
    expect(findings[0]?.file).toBe('/tasks (ar)');
    const root = fileURLToPath(new URL('./fixtures/a11y', import.meta.url));
    expect(await pageRoutes(root)).toEqual(['/home', '/login']);
  });
});
