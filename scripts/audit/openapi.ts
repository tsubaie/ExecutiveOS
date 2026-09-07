import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { statuses, type ErrorCode } from '../../src/core/http/errors';
import { exists, read, walk } from './lib/files';
import { report, finish } from './lib/report';
const Meta = z.object({
  guard: z.enum(['public', 'session', 'admin']),
  status: z.number(),
  source: z.enum(['body', 'query']),
  idempotent: z.boolean(),
  input: z.instanceof(z.ZodType),
  response: z.instanceof(z.ZodType),
});
export type Meta = z.infer<typeof Meta>;
const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
const components = new Map<z.ZodType, { name: string; schema: Json }>();
function component(schema: z.ZodType, name: string, io: 'input' | 'output') {
  const known = components.get(schema);
  if (known) return { $ref: `#/components/schemas/${known.name}` };
  const json = z
    .json()
    .parse(z.toJSONSchema(schema, { io, unrepresentable: 'any', reused: 'ref' }));
  components.set(schema, { name, schema: json });
  return { $ref: `#/components/schemas/${name}` };
}
export function resetComponents() {
  components.clear();
}
const JsonSchema = z.object({
  properties: z.record(z.string(), z.json()).default({}),
  required: z.array(z.string()).default([]),
});
type Json = z.infer<ReturnType<typeof z.json>>;
const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'details', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
        requestId: { type: 'string' },
      },
    },
  },
};
export function routePath(file: string) {
  return file
    .replace(/^src\/app/u, '')
    .replace(/\/route\.ts$/u, '')
    .replaceAll(/\[(\w+)\]/gu, '{$1}');
}
export function errorCodes(method: string, path: string, meta: Meta): ErrorCode[] {
  const codes: ErrorCode[] = ['validation_failed', 'forbidden', 'internal', 'ai_unavailable'];
  if (meta.guard !== 'public') codes.push('unauthenticated');
  if (path.includes('{id}')) codes.push('not_found');
  if (meta.idempotent || ['PATCH', 'DELETE'].includes(method)) codes.push('conflict');
  if (method !== 'GET') codes.push('rule_violation');
  if (path.endsWith('/auth/login') || path.endsWith('/setup')) codes.push('rate_limited');
  return codes;
}
function successResponse(meta: Meta, name: string): Json {
  if (meta.status === 204)
    return {
      description: 'Deleted',
      headers: { 'X-Op-Id': { schema: { type: 'string', format: 'uuid' } } },
    };
  return {
    description: 'Success',
    content: {
      'application/json': { schema: component(meta.response, `${name}Response`, 'output') },
    },
  };
}
function inputSide(method: string, meta: Meta, name: string): Json {
  if (meta.source === 'query' || method === 'GET') {
    const parsed = JsonSchema.parse(
      z.toJSONSchema(meta.input, { io: 'input', unrepresentable: 'any', reused: 'ref' }),
    );
    return {
      parameters: Object.entries(parsed.properties).map(([key, property]) => ({
        name: key,
        in: 'query',
        required: parsed.required.includes(key),
        schema: property,
      })),
    };
  }
  return {
    requestBody: {
      required: true,
      content: { 'application/json': { schema: component(meta.input, `${name}Body`, 'input') } },
    },
  };
}
export function operationId(method: string, path: string) {
  return `${method.toLowerCase()}${path
    .replace(/^\/api\/v1/u, '')
    .replaceAll(/[^a-zA-Z0-9]+(\w)?/gu, (_, c: string | undefined) => (c ?? '').toUpperCase())}`;
}
export function buildOperation(method: string, path: string, meta: Meta): Json {
  const name = operationId(method, path);
  const responses: Record<string, Json> = { [String(meta.status)]: successResponse(meta, name) };
  for (const code of errorCodes(method, path, meta))
    responses[String(statuses[code])] = {
      description: code,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    };
  const params = [...path.matchAll(/\{(\w+)\}/gu)].map((m) => ({
    name: m[1] ?? '',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  }));
  const input = z
    .object({ parameters: z.array(z.json()).default([]), requestBody: z.json().optional() })
    .parse(inputSide(method, meta, name));
  return {
    operationId: name,
    security: meta.guard === 'public' ? [] : [{ session: [] }],
    ...(meta.idempotent ? { 'x-idempotency-key': 'required' } : {}),
    parameters: [...params, ...input.parameters],
    ...(input.requestBody === undefined ? {} : { requestBody: input.requestBody }),
    responses,
  };
}
export function bareOperation(method: string, path: string): Json {
  return {
    operationId: `${method.toLowerCase()}${path.replace(/^\/api\/v1\//u, '')}`,
    security: [],
    responses: {
      '200': {
        description: 'Bare object (envelope exception)',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
  };
}
export function stableJson(value: Json) {
  return `${JSON.stringify(
    value,
    (_, item: Json) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
    2,
  )}\n`;
}
async function collectPaths(root: string) {
  const paths: Record<string, Json> = {};
  const files = (await walk(join(root, 'src/app/api')))
    .filter((f) => f.endsWith('route.ts'))
    .map((f) => `src/app/api/${f}`);
  for (const file of files.sort()) {
    const exported = z
      .record(z.string(), z.unknown())
      .parse(await import(pathToFileURL(join(root, file)).href));
    const path = routePath(file);
    const operations: Record<string, Json> = {};
    for (const method of methods) {
      const handler = exported[method];
      if (typeof handler !== 'function') continue;
      const meta = Meta.safeParse(Reflect.get(handler, 'meta'));
      operations[method.toLowerCase()] = meta.success
        ? buildOperation(method, path, meta.data)
        : bareOperation(method, path);
    }
    paths[path] = operations;
  }
  return paths;
}
export async function buildDocument(root: string) {
  resetComponents();
  const version = z
    .object({ version: z.string() })
    .parse(JSON.parse(await read(join(root, 'package.json')))).version;
  const paths = await collectPaths(root);
  return stableJson({
    openapi: '3.1.0',
    info: { title: 'ExecutiveOS API', version },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'eos_session' } },
      schemas: {
        Error: errorSchema,
        ...Object.fromEntries([...components.values()].map((item) => [item.name, item.schema])),
      },
    },
    paths,
  });
}
export function evaluateDocument(existing: string | null, generated: string) {
  const result = report('audit:openapi');
  if (existing === null)
    result.violations.push({
      rule: 'openapi-missing',
      file: 'openapi.json',
      message: 'run pnpm audit:openapi --write',
    });
  else if (existing !== generated)
    result.violations.push({
      rule: 'openapi-drift',
      file: 'openapi.json',
      message: 'committed file differs from the handlers; run pnpm audit:openapi --write',
    });
  return result;
}
if (process.argv[1]?.endsWith('openapi.ts')) {
  const root = process.cwd();
  const generated = await buildDocument(root);
  const target = join(root, 'openapi.json');
  if (process.argv.includes('--write')) await writeFile(target, generated);
  finish(evaluateDocument((await exists(target)) ? await read(target) : null, generated));
}
