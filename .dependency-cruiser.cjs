const server =
  '(?:src/core/(?:db|auth|ai|jobs|files|backup|entity)/|src/core/modules/(?:registry|server-manifest)\\.ts$|src/core/config/env\\.ts$|src/modules/[^/]+/(?:service|repo)\\.ts$|src/modules/[^/]+/schema/(?:db|index)\\.ts$)';
const rule = (name, from, to) => ({ name, severity: 'error', from, to });
const clientFiles = require('./tools/eslint/client-files.cjs');
const clientPaths = clientFiles().map((path) => path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));

module.exports = {
  forbidden: [
    ...clientPaths.map((path) =>
      rule(
        'client-route-server-boundary:' + path,
        { path: '^' + path + '$' },
        { path: server, reachable: true },
      ),
    ),
    rule('no-cycles', {}, { circular: true }),
    rule('no-unresolved', {}, { couldNotResolve: true }),
    rule(
      'client-ui-cannot-reach-server',
      { path: '^src/(?:ui/|modules/[^/]+/ui/)' },
      { path: server, reachable: true },
    ),
    rule(
      'routes-cannot-access-repositories',
      { path: '^src/app/' },
      { path: '^src/modules/[^/]+/(?:repo\\.ts|schema/db\\.ts)$' },
    ),
    rule(
      'routes-cannot-import-drizzle',
      { path: '^src/app/' },
      { path: '(?:^|/)drizzle-orm(?:/|$)' },
    ),
    rule(
      'services-use-public-cross-module-api',
      { path: '^src/modules/([^/]+)/service\\.ts$' },
      { path: '^src/modules/(?!$1/)[^/]+/(?!index\\.ts$)' },
    ),
    rule(
      'module-ui-uses-public-cross-module-ui',
      { path: '^src/modules/([^/]+)/ui/' },
      { path: '^src/modules/(?!$1/)[^/]+/(?!ui/index\\.ts$|schema/validation\\.ts$)' },
    ),
    rule(
      'repo-import-allowlist',
      { path: '^src/modules/([^/]+)/repo\\.ts$' },
      {
        pathNot:
          '^(?:src/modules/$1/schema/db\\.ts$|src/core/(?:db|links|search)/|node_modules/.*(?:drizzle-orm|server-only)/)',
      },
    ),
    rule(
      'module-jobs-import-allowlist',
      { path: '^src/modules/([^/]+)/(?:jobs\\.ts$|ai/)' },
      { path: '^src/modules/(?!$1/)' },
    ),
    rule(
      'core-cannot-import-module-internals',
      { path: '^src/core/' },
      { path: '^src/modules/[^/]+/(?!index\\.ts$|manifest\\.ts$)' },
    ),
    rule(
      'core-module-surface-exceptions-only',
      { path: '^src/core/(?!links/|jobs/registry\\.ts$|modules/)' },
      { path: '^src/modules/' },
    ),
    rule(
      'subprocesses-only-in-backup',
      { path: '^src/(?!core/backup/)' },
      { path: '^(?:node:)?child_process$' },
    ),
    rule(
      'anthropic-only-in-core-ai',
      { path: '^src/(?!core/ai/)' },
      { path: '(?:^|/)@anthropic-ai/' },
    ),
    rule(
      'no-domain-event-emitter',
      { path: '^src/' },
      { path: '^(?:(?:node:)?events|eventemitter3)$' },
    ),
    rule(
      'chart-library-only-in-wrappers',
      { path: '^src/(?!ui/charts/)' },
      { path: '(?:^|/)recharts(?:/|$)' },
    ),
    rule(
      'markdown-renderer-only-in-ui-markdown',
      { path: '^src/(?!ui/markdown/)' },
      { path: '(?:^|/)(?:react-markdown|remark-gfm|rehype-sanitize)(?:/|$)' },
    ),
    rule(
      'client-validation-is-client-safe',
      { path: '^src/modules/[^/]+/schema/validation\\.ts$' },
      { path: server, reachable: true },
    ),
    rule(
      'module-manifest-is-client-safe',
      { path: '^src/modules/[^/]+/manifest\\.ts$' },
      { path: server, reachable: true },
    ),
    rule(
      'core-modules-client-imports-manifests-only',
      { path: '^src/core/modules/(?:client|manifest)\\.ts$' },
      { path: '^src/modules/(?!.*/manifest\\.ts$)' },
    ),
    rule(
      'entity-framework-is-module-independent',
      { path: '^src/ui/entity/' },
      { path: '^src/modules/', reachable: true },
    ),
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(?:^|/)(?:tests|fixtures)/|\\.(?:test|spec)\\.' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'node', 'default'],
      exportsFields: ['exports'],
    },
  },
};
