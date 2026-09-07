import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { buildOperation, errorCodes, evaluateDocument, routePath, stableJson } from '../openapi';
import { evaluateBundle, limitBytes, parseClientManifest, scanMarkers } from '../bundle';
const fixture = (path: string) => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
describe('audit:openapi', () => {
  const Op = z.object({
    parameters: z.array(z.object({ name: z.string(), in: z.string(), required: z.boolean() })),
    requestBody: z.json().optional(),
    responses: z.record(z.string(), z.json()),
    security: z.array(z.json()),
  });
  it('describes body handlers, query handlers, path params, idempotency and declared errors', () => {
    const meta = {
      guard: 'session' as const,
      status: 200,
      source: 'body' as const,
      idempotent: true,
      input: z.strictObject({ revision: z.number().int() }),
      response: z.object({ data: z.object({ id: z.uuid() }) }),
    };
    const op = Op.parse(buildOperation('POST', '/api/v1/tasks/{id}/complete', meta));
    expect(op.parameters).toEqual([{ name: 'id', in: 'path', required: true }]);
    expect(JSON.stringify(op.requestBody)).toContain(
      '#/components/schemas/postTasksIdCompleteBody',
    );
    expect(Object.keys(op.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
      '422',
      '500',
      '503',
    ]);
    expect(op.security).toEqual([{ session: [] }]);
    const query = Op.parse(
      buildOperation('GET', '/api/v1/tasks', {
        ...meta,
        idempotent: false,
        input: z.strictObject({
          view: z.string().default('all'),
          limit: z.coerce.number().optional(),
        }),
      }),
    );
    expect(query.parameters.map((p) => `${p.name}:${p.required}`)).toEqual([
      'view:false',
      'limit:false',
    ]);
    expect(query.requestBody).toBeUndefined();
    expect(errorCodes('POST', '/api/v1/auth/login', { ...meta, guard: 'public' })).toContain(
      'rate_limited',
    );
    expect(routePath('src/app/api/v1/tasks/[id]/route.ts')).toBe('/api/v1/tasks/{id}');
    expect(
      buildOperation('DELETE', '/api/v1/people/{id}', { ...meta, status: 204, idempotent: false }),
    ).toMatchObject({ responses: { '204': { headers: { 'X-Op-Id': {} } } } });
  });
  it('fails when the committed document is missing or drifted and sorts keys stably', () => {
    const generated = stableJson({ b: 1, a: { d: 1, c: 2 } });
    expect(generated).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}\n');
    expect(evaluateDocument(null, generated).violations[0]?.rule).toBe('openapi-missing');
    expect(evaluateDocument('{}', generated).violations[0]?.rule).toBe('openapi-drift');
    expect(evaluateDocument(generated, generated).violations).toEqual([]);
  });
});
describe('audit:bundle', () => {
  it('reads chunks from the client reference manifest and flags size and server markers', async () => {
    const parsed = parseClientManifest(await readFile(fixture('bundle/manifest.js'), 'utf8'));
    expect(parsed).toEqual({
      route: '/(app)/tasks/page',
      chunks: ['/_next/static/chunks/a.js', '/_next/static/chunks/shared.js'],
    });
    expect(scanMarkers('const url = process.env.DATABASE_URL; argon2id')).toEqual([
      '\\bDATABASE_URL\\b',
      '\\bargon2id\\b',
    ]);
    expect(scanMarkers('export const ok = 1;')).toEqual([]);
    const root = { file: 'root.js', gzipBytes: 1024, markers: [] };
    const result = evaluateBundle({
      shared: [root],
      routes: [
        { route: '/big', chunks: [root, { file: 'x.js', gzipBytes: limitBytes + 1, markers: [] }] },
        {
          route: '/leaky',
          chunks: [{ file: 'y.js', gzipBytes: 10, markers: ['\\bDATABASE_URL\\b'] }],
        },
        {
          route: '/fine',
          chunks: [root, { file: 'z.js', gzipBytes: limitBytes - 1, markers: [] }],
        },
      ],
    });
    expect(result.warnings[0]?.message).toBe('1 KB gzipped root bundle loaded by every route');
    expect(result.violations.map((v) => `${v.rule}:${v.file}`)).toEqual([
      'route-size:/big',
      'server-code-in-client:y.js',
    ]);
  });
});
