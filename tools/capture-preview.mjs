import { chromium, expect } from '@playwright/test';
import { lookup } from 'node:dns/promises';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const { address } = await lookup('app');
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost ' + address] });
const state = JSON.parse(await readFile('tmp/browser-state.json', 'utf8'));
const cleanup = await browser.newPage({ storageState: state });
await cleanup.goto('http://localhost:3000/people');
const personId = await cleanup.evaluate(async () => {
  const response = await fetch('/api/v1/people?limit=200');
  const { data } = await response.json();
  for (const person of data)
    if (/^(Preview|Idempotency) [0-9a-f-]{36}$/.test(person.fullName))
      await fetch('/api/v1/people/' + person.id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ExecutiveOS' },
        body: JSON.stringify({ revision: person.revision }),
      });
  return data.find((person) => person.fullName === 'Leila Haddad').id;
});
await cleanup.close();
await mkdir('docs/screenshots', { recursive: true });
const findings = [];
for (const locale of ['en', 'ar'])
  for (const [size, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ storageState: state, viewport });
    await context.addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
    await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const page = await context.newPage();
    const routes = [
      ['login', '/login'],
      ['setup', '/setup'],
      ['home', '/home'],
      ['admin-users', '/admin/users'],
      ['admin-settings', '/admin/settings'],
      ['admin-backups', '/admin/backups'],
      ['people-list', '/people'],
      ['people-detail', '/people?id=' + personId],
      ['people-create', '/people?new=1'],
    ];
    for (const [name, path] of routes) {
      await page.goto('http://localhost:3000' + path);
      await page.locator('h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (name === 'people-detail')
        await page.getByRole('heading', { name: 'Leila Haddad', exact: true }).waitFor();
      if (name === 'people-list')
        await page.getByRole('button').filter({ hasText: 'Leila Haddad' }).waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0) throw new Error(name + ' ' + locale + ' ' + size + ' overflow ' + overflow);
      const axe = await new AxeBuilder({ page }).analyze();
      findings.push({
        route: name,
        locale,
        size,
        violations: axe.violations
          .filter((v) => ['serious', 'critical'].includes(v.impact))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      });
      await page.screenshot({
        path: 'docs/screenshots/' + name + '-' + locale + '-' + size + '.png',
        animations: 'disabled',
      });
      if (name === 'home' || name === 'people-list') {
        await page
          .getByRole('button', { name: locale === 'ar' ? 'تبديل المظهر' : 'Toggle theme' })
          .click();
        await expect(page.locator('html')).toHaveClass(/light/);
        await page.screenshot({
          path: 'docs/screenshots/' + name + '-' + locale + '-' + size + '-light.png',
          animations: 'disabled',
        });
      }
    }
    await context.close();
  }
await writeFile('tmp/a11y-preview.json', JSON.stringify(findings, null, 2));
process.stdout.write(
  JSON.stringify(
    { screenshots: 44, seriousOrCritical: findings.filter((f) => f.violations.length) },
    null,
    2,
  ) + '\n',
);
await browser.close();
