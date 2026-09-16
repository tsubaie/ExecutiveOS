import { chromium, expect } from '@playwright/test';
import { lookup } from 'node:dns/promises';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
// Against the Compose preview the `app` host is mapped to localhost and the saved browser state is
// reused; inside the tooling container the standalone server answers on localhost directly and the
// browser-test account signs in through the login form (`--local`), as capture-notes does.
const address = process.argv.includes('--local')
  ? null
  : await lookup('app').then(
      (hit) => hit.address,
      () => null,
    );
const browser = await chromium.launch({
  args: address ? ['--host-resolver-rules=MAP localhost ' + address] : [],
});
const state = address ? JSON.parse(await readFile('tmp/browser-state.json', 'utf8')) : undefined;
async function signIn(page) {
  const account = JSON.parse(await readFile('e2e/.auth/credentials.json', 'utf8'));
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/home/);
}
const cleanup = await browser.newPage({ ...(state ? { storageState: state } : {}) });
if (!state) await signIn(cleanup);
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
await mkdir('tmp/screenshots', { recursive: true });
const findings = [];
for (const locale of ['en', 'ar'])
  for (const [size, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      ...(state ? { storageState: state } : {}),
      viewport,
    });
    await context.addCookies([{ name: 'eos_locale', value: 'en', url: 'http://localhost:3000' }]);
    await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const page = await context.newPage();
    if (!state) await signIn(page);
    await context.addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
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
      // On a phone an open record or the create form covers the list and its title with it
      // (EP-B07), so the wait is for whichever heading is actually on screen; the detail route
      // waits for the record's own name.
      if (name === 'people-detail')
        await page.getByRole('heading', { name: 'Leila Haddad', exact: true }).waitFor();
      else await page.locator('h1:visible, h2:visible').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
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
        path: 'tmp/screenshots/' + name + '-' + locale + '-' + size + '.png',
        animations: 'disabled',
      });
      // The theme toggle moved from the header into the account menu; the light capture sets the
      // theme the way the page reads it rather than clicking a control that is no longer there.
      if (name === 'home' || name === 'people-list') {
        // next-themes applies a theme written by another tab through the storage event; firing it
        // here switches the page in place, under the init script that pins every load to dark.
        await page.evaluate(() => {
          localStorage.setItem('theme', 'light');
          window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'light' }));
        });
        await expect(page.locator('html')).toHaveClass(/light/);
        await page.screenshot({
          path: 'tmp/screenshots/' + name + '-' + locale + '-' + size + '-light.png',
          animations: 'disabled',
        });
        await page.evaluate(() => {
          localStorage.setItem('theme', 'dark');
          window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }));
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
