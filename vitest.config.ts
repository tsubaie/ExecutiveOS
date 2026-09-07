import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/fixtures/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/**/*.test.ts',
      'scripts/audit/tests/**/*.test.{ts,mjs}',
    ],
    globalSetup: ['tests/setup/global-setup.ts'],
    exclude: ['**/fixtures/**'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    // Integration suites share the explicitly configured PostgreSQL test database.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/**/service.ts',
        'src/modules/**/repo.ts',
        'src/modules/**/schema/validation.ts',
        'src/ui/**/*.{ts,tsx}',
      ],
      exclude: ['**/tests/**', 'src/ui/primitives/**'],
      thresholds: { perFile: true, branches: 70 },
    },
  },
});
