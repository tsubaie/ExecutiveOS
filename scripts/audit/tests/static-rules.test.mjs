import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parser } from 'typescript-eslint';
import eos from '../../../tools/eslint/index.mjs';

const fixtures = JSON.parse(
  await readFile(new URL('./fixtures/static-invalid.json', import.meta.url), 'utf8'),
);

function lint(code, rule, file = 'src/ui/Example.tsx') {
  return new Linter().verify(
    code,
    [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: { jsx: true },
          },
        },
        plugins: { eos },
        rules: { [`eos/${rule}`]: 'error' },
      },
    ],
    { filename: resolve(file) },
  );
}

describe('WI-0001-M1 static guardrails reject violating fixtures', () => {
  it.each(fixtures)('$rule rejects $code', ({ code, rule, file }) => {
    const messages = lint(code, rule, file);
    expect(messages.some((message) => message.ruleId === `eos/${rule}`)).toBe(true);
    expect(messages.some((message) => message.fatal)).toBe(false);
  });

  it('accepts semantic logical styling and translated labels', () => {
    const code =
      'const c = <button className="bg-surface text-start ms-2" aria-label={t("action")}>{t("action")}</button>;';
    for (const rule of ['no-color-literals', 'logical-props', 'no-literal-strings'])
      expect(lint(code, rule)).toEqual([]);
  });

  it('accepts documented external synchronization', () => {
    expect(
      lint('// sync: browser focus\nuseEffect(() => subscribe(), []);', 'effect-sync'),
    ).toEqual([]);
  });

  it('accepts documented casts only at allowed boundaries', () => {
    const code = 'const row = value as Row; // cast: database adapter has validated the row';
    expect(lint(code, 'cast-comments', 'src/core/db/adapter.ts')).toEqual([]);
    expect(lint(code, 'cast-comments', 'src/ui/Example.tsx')).toHaveLength(1);
  });

  it('accepts environment reads only in the configuration module', () => {
    expect(lint('const raw = process.env;', 'environment', 'src/core/config/env.ts')).toEqual([]);
  });
});
