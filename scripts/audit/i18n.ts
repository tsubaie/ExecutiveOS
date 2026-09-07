import { join } from 'node:path';
import { z } from 'zod';
import {
  parse,
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { read, tracked } from './lib/files';
import { report, finish, type Finding, type Report } from './lib/report';
const Catalog = z.record(z.string(), z.record(z.string(), z.string()));
export type Catalog = z.infer<typeof Catalog>;
export type Usage = { file: string; namespace: string; key: string | null };
export function argumentNames(message: string) {
  const names = new Set<string>();
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (
        isArgumentElement(element) ||
        isNumberElement(element) ||
        isDateElement(element) ||
        isTimeElement(element)
      )
        names.add(element.value);
      if (isPluralElement(element) || isSelectElement(element)) {
        names.add(element.value);
        for (const option of Object.values(element.options)) visit(option.value);
      }
      if (isTagElement(element)) visit(element.children);
    }
  };
  visit(parse(message, { ignoreTag: true }));
  return [...names].sort();
}
export function scanUsages(file: string, text: string): Usage[] {
  const usages: Usage[] = [];
  const binding =
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([\w.]+)'\s*\)/gu;
  for (const match of text.matchAll(binding)) {
    const [, name = '', namespace = ''] = match;
    const call = new RegExp(
      `(?<![\\w.])${name}\\(\\s*(?:(['"])([^'"]+)\\1|\`([^\`]*)\`|([^'"\`)\\s]))`,
      'gu',
    );
    for (const use of text.matchAll(call)) {
      const literal = use[2] ?? (use[3] !== undefined && !use[3].includes('${') ? use[3] : null);
      usages.push({ file, namespace, key: literal });
    }
  }
  return usages;
}
function icuFindings(locale: string, catalog: Catalog): Finding[] {
  const findings: Finding[] = [];
  for (const [namespace, messages] of Object.entries(catalog))
    for (const [key, message] of Object.entries(messages))
      try {
        argumentNames(message);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'invalid ICU';
        findings.push({
          rule: 'icu-syntax',
          file: `${locale}:${namespace}.${key}`,
          message: reason,
        });
      }
  return findings;
}
function catalogKeys(catalog: Catalog) {
  return new Set(
    Object.entries(catalog).flatMap(([ns, m]) => Object.keys(m).map((k) => `${ns}.${k}`)),
  );
}
function parityFindings(enKeys: Set<string>, arKeys: Set<string>): Finding[] {
  const findings: Finding[] = [];
  for (const key of enKeys)
    if (!arKeys.has(key))
      findings.push({ rule: 'catalog-parity', file: key, message: 'missing in ar' });
  for (const key of arKeys)
    if (!enKeys.has(key))
      findings.push({ rule: 'catalog-parity', file: key, message: 'missing in en' });
  return findings;
}
function argumentFindings(en: Catalog, ar: Catalog): Finding[] {
  const findings: Finding[] = [];
  for (const [namespace, messages] of Object.entries(en))
    for (const key of Object.keys(messages)) {
      const other = ar[namespace]?.[key];
      if (other === undefined) continue;
      try {
        if (argumentNames(messages[key] ?? '').join() !== argumentNames(other).join())
          findings.push({
            rule: 'icu-arguments',
            file: `${namespace}.${key}`,
            message: 'argument names differ between en and ar',
          });
      } catch {
        continue;
      }
    }
  return findings;
}
function usageFindings(enKeys: Set<string>, usages: Usage[]) {
  const violations: Finding[] = [];
  const dynamic = new Map<string, number>();
  for (const usage of usages)
    if (usage.key === null) dynamic.set(usage.file, (dynamic.get(usage.file) ?? 0) + 1);
    else if (!enKeys.has(`${usage.namespace}.${usage.key}`))
      violations.push({
        rule: 'unresolved-key',
        file: usage.file,
        message: `${usage.namespace}.${usage.key} is not in the catalog`,
      });
  const warnings: Finding[] = [...dynamic].map(([file, count]) => ({
    rule: 'dynamic-key',
    file,
    message: `${count} dynamic key(s) not statically checked`,
  }));
  return { violations, warnings };
}
export function evaluate(en: Catalog, ar: Catalog, usages: Usage[]): Report {
  const result = report('audit:i18n');
  const enKeys = catalogKeys(en);
  result.violations.push(
    ...parityFindings(enKeys, catalogKeys(ar)),
    ...icuFindings('en', en),
    ...icuFindings('ar', ar),
    ...argumentFindings(en, ar),
  );
  const usage = usageFindings(enKeys, usages);
  result.violations.push(...usage.violations);
  result.warnings.push(...usage.warnings);
  return result;
}
export async function auditI18n(root: string) {
  const en = Catalog.parse(JSON.parse(await read(join(root, 'src/core/i18n/messages/en.json'))));
  const ar = Catalog.parse(JSON.parse(await read(join(root, 'src/core/i18n/messages/ar.json'))));
  const usages: Usage[] = [];
  for (const file of tracked(root).filter((f) => /^src\/.*\.tsx?$/u.test(f)))
    usages.push(...scanUsages(file, await read(join(root, file))));
  return evaluate(en, ar, usages);
}
if (process.argv[1]?.endsWith('i18n.ts')) finish(await auditI18n(process.cwd()));
