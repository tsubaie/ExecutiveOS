import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, read, tracked, isTestSource, walk } from './lib/files';
import { report, finish, type Finding, type Report } from './lib/report';
import { loadSpecs, specForModule } from './lib/specs';
export type ModuleTests = {
  name: string;
  status: string | null;
  testFiles: string[];
  uiTests: number;
  e2e: boolean;
  mutationTargets: boolean;
};
const layers = [
  'schema.test.ts',
  'service.test.ts',
  'repo.test.ts',
  'constraints.test.ts',
  'api.test.ts',
];
export function evaluateModuleTests(item: ModuleTests): {
  violations: Finding[];
  warnings: Finding[];
} {
  const violations: Finding[] = [];
  const warnings: Finding[] = [];
  const file = `src/modules/${item.name}/tests`;
  if (!item.testFiles.length)
    violations.push({ rule: 'module-scenarios', file, message: 'no scenario file' });
  const missing = layers.filter((layer) => !item.testFiles.includes(layer));
  if (!item.uiTests) missing.push('ui/*.test.tsx');
  if (!item.e2e) missing.push(`e2e/${item.name}.spec.ts`);
  if (!item.mutationTargets) missing.push('mutation targets in the spec');
  if (missing.length) {
    const finding = { rule: 'module-layers', file, message: `missing ${missing.join(', ')}` };
    if (item.status === 'implemented') violations.push(finding);
    else warnings.push(finding);
  }
  return { violations, warnings };
}
export function scanTestSource(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (/from ['"]node:fs|\breadFileSync\(|\breadFile\(/u.test(line))
      findings.push({
        rule: 'test-reads-files',
        file: `${file}:${index + 1}`,
        message: 'tests must not read files',
      });
    if (/\b(?:it|test|describe)\.(?:skip|todo|only)\(/u.test(line)) {
      const context = `${lines[index - 1] ?? ''}\n${line}`;
      if (!/https?:\/\/\S+\/issues\/\d+/u.test(context))
        findings.push({
          rule: 'test-skipped',
          file: `${file}:${index + 1}`,
          message: 'skipped test without an issue link',
        });
    }
  });
  return findings;
}
export function evaluateTests(
  modules: ModuleTests[],
  sources: { file: string; text: string }[],
): Report {
  const result = report('audit:tests');
  for (const item of modules) {
    const findings = evaluateModuleTests(item);
    result.violations.push(...findings.violations);
    result.warnings.push(...findings.warnings);
  }
  for (const source of sources) result.violations.push(...scanTestSource(source.file, source.text));
  return result;
}
async function collectModuleTests(root: string, name: string): Promise<ModuleTests> {
  const specs = await loadSpecs(root);
  const spec = specForModule(specs, name);
  const dir = join(root, 'src/modules', name, 'tests');
  const files = (await exists(dir)) ? await walk(dir) : [];
  return {
    name,
    status: spec?.status ?? null,
    testFiles: files.filter(isTestSource),
    uiTests: files.filter((f) => f.startsWith('ui/') && isTestSource(f)).length,
    e2e: await exists(join(root, 'e2e', `${name}.spec.ts`)),
    mutationTargets: /mutation/iu.test(spec?.text ?? ''),
  };
}
export async function auditTests(root: string) {
  const modules: ModuleTests[] = [];
  for (const name of (await readdir(join(root, 'src/modules'))).sort())
    modules.push(await collectModuleTests(root, name));
  const sources: { file: string; text: string }[] = [];
  for (const file of tracked(root).filter(
    (f) => isTestSource(f) && !f.startsWith('scripts/audit/tests/'),
  ))
    sources.push({ file, text: await read(join(root, file)) });
  return evaluateTests(modules, sources);
}
if (process.argv[1]?.endsWith('tests.ts')) finish(await auditTests(process.cwd()));
