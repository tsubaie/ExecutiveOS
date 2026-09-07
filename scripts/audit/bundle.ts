import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { exists, walk } from './lib/files';
import { report, finish, type Report } from './lib/report';
export type Chunk = { file: string; gzipBytes: number; markers: string[] };
export type RouteChunks = { route: string; chunks: Chunk[] };
export type Bundle = { shared: Chunk[]; routes: RouteChunks[] };
const markers = [
  /cannot be imported from a Client Component/u,
  /\bDATABASE_URL\b/u,
  /\bSESSION_SECRET\b/u,
  /\bANTHROPIC_API_KEY\b/u,
  /pg_advisory_xact_lock/u,
  /\bargon2id\b/u,
];
const Manifest = z.object({
  clientModules: z.record(z.string(), z.object({ chunks: z.array(z.string()) })),
});
const BuildManifest = z.object({
  rootMainFiles: z.array(z.string()).default([]),
  polyfillFiles: z.array(z.string()).default([]),
});
export const limitBytes = 250 * 1024;
export function parseClientManifest(text: string) {
  const match = text.match(/__RSC_MANIFEST\[["']([^"']+)["']\]\s*=\s*(\{[\s\S]*\});?\s*$/u);
  if (!match) throw new Error('unrecognized client reference manifest');
  const manifest = Manifest.parse(JSON.parse(match[2] ?? '{}'));
  const chunks = new Set<string>();
  for (const entry of Object.values(manifest.clientModules))
    for (const chunk of entry.chunks) chunks.add(chunk);
  return { route: match[1] ?? '', chunks: [...chunks].sort() };
}
export function scanMarkers(text: string) {
  return markers.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}
function uniqueTotal(chunks: Chunk[]) {
  const unique = [...new Map(chunks.map((chunk) => [chunk.file, chunk])).values()];
  return unique.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
}
export function evaluateBundle(bundle: Bundle, limit = limitBytes): Report {
  const result = report('audit:bundle');
  const shared = new Set(bundle.shared.map((chunk) => chunk.file));
  result.warnings.push({
    rule: 'shared-bundle',
    message: `${Math.round(uniqueTotal(bundle.shared) / 1024)} KB gzipped root bundle loaded by every route`,
  });
  const seen = new Set<string>();
  for (const route of bundle.routes) {
    const own = route.chunks.filter((chunk) => !shared.has(chunk.file));
    const total = uniqueTotal(own);
    if (total > limit)
      result.violations.push({
        rule: 'route-size',
        file: route.route,
        message: `${Math.round(total / 1024)} KB gzipped route-specific JS exceeds ${Math.round(limit / 1024)} KB`,
      });
    for (const chunk of [...bundle.shared, ...own])
      if (chunk.markers.length && !seen.has(chunk.file)) {
        seen.add(chunk.file);
        result.violations.push({
          rule: 'server-code-in-client',
          file: chunk.file,
          message: `contains ${chunk.markers.join(', ')}`,
        });
      }
  }
  return result;
}
function chunkPath(root: string, reference: string) {
  return join(root, '.next', reference.replace(/^\/_next\//u, ''));
}
export async function collectBundle(root: string): Promise<Bundle> {
  const build = BuildManifest.parse(
    JSON.parse(await readFile(join(root, '.next/build-manifest.json'), 'utf8')),
  );
  const cache = new Map<string, Chunk>();
  const load = async (reference: string) => {
    const file = chunkPath(root, reference);
    const cached = cache.get(file);
    if (cached) return cached;
    const text = (await exists(file)) ? await readFile(file, 'utf8') : null;
    const chunk: Chunk =
      text === null
        ? { file: reference, gzipBytes: 0, markers: ['missing chunk file'] }
        : { file: reference, gzipBytes: gzipSync(text).length, markers: scanMarkers(text) };
    cache.set(file, chunk);
    return chunk;
  };
  const shared = await Promise.all([...build.rootMainFiles, ...build.polyfillFiles].map(load));
  const routes: RouteChunks[] = [];
  const app = join(root, '.next/server/app');
  for (const file of (await walk(app)).filter((f) =>
    f.endsWith('page_client-reference-manifest.js'),
  )) {
    const parsed = parseClientManifest(await readFile(join(app, file), 'utf8'));
    routes.push({ route: parsed.route, chunks: await Promise.all(parsed.chunks.map(load)) });
  }
  return { shared, routes };
}
if (process.argv[1]?.endsWith('bundle.ts'))
  finish(evaluateBundle(await collectBundle(process.cwd())));
