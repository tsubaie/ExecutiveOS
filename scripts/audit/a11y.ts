import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from '../../e2e/fixtures/auth';
import { walk } from './lib/files';
import { report, finish, type Finding } from './lib/report';
export type AxeViolation = { id: string; impact: string | null | undefined; nodes: number };
const locales = ['en', 'ar'];
export function evaluateAxe(route: string, locale: string, violations: AxeViolation[]): Finding[] {
  return violations
    .filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .map((item) => ({
      rule: `axe:${item.id}`,
      file: `${route} (${locale})`,
      message: `${item.impact} on ${item.nodes} node(s)`,
    }));
}
export async function pageRoutes(root: string) {
  const pages = (await walk(join(root, 'src/app'))).filter(
    (f) => f.endsWith('page.tsx') && !f.includes('['),
  );
  return pages
    .map((file) => `/${file.replace(/\/?page\.tsx$/u, '')}`.replaceAll(/\/\([^)]+\)/gu, ''))
    .filter((route) => route !== '/' && route !== '/setup')
    .sort();
}
async function healthy(baseUrl: string) {
  try {
    return (await fetch(`${baseUrl}/api/v1/health`)).ok;
  } catch {
    return false;
  }
}
async function ensureServer(baseUrl: string, probeUrl: string) {
  if (await healthy(probeUrl)) return () => undefined;
  // The standalone server binds to HOSTNAME, which containers set to their id; pin it to loopback.
  const child = spawn(
    'sh',
    ['-c', 'HOSTNAME=127.0.0.1 PORT=3000 exec "$0" .next/standalone/server.js', process.execPath],
    { stdio: 'ignore' },
  );
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await healthy(probeUrl)) return () => child.kill();
  }
  child.kill();
  throw new Error(`No server answered at ${baseUrl}; run pnpm build first`);
}
export async function auditA11y(root: string, baseUrl: string, resolveLocalhost?: string) {
  const result = report('audit:a11y');
  const stop = await ensureServer(
    baseUrl,
    resolveLocalhost ? baseUrl.replace('localhost', resolveLocalhost) : baseUrl,
  );
  const browser = await chromium.launch({
    args: resolveLocalhost ? [`--host-resolver-rules=MAP localhost ${resolveLocalhost}`] : [],
  });
  try {
    for (const locale of locales) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      await loginAs(page, locale);
      for (const route of await pageRoutes(root)) {
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.locator('h1').first().waitFor({ timeout: 15000 });
        const scan = await new AxeBuilder({ page }).analyze();
        result.violations.push(
          ...evaluateAxe(
            route,
            locale,
            scan.violations.map((item) => ({
              id: item.id,
              impact: item.impact,
              nodes: item.nodes.length,
            })),
          ),
        );
      }
      await context.close();
    }
  } finally {
    await browser.close();
    stop();
  }
  process.stdout.write(
    `scanned ${(await pageRoutes(root)).length} routes in ${locales.join(', ')}\n`,
  );
  return result;
}
if (process.argv[1]?.endsWith('a11y.ts')) {
  const option = (name: string) =>
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  finish(
    await auditA11y(
      process.cwd(),
      option('base-url') ?? 'http://localhost:3000',
      option('resolve-localhost'),
    ),
  );
}
