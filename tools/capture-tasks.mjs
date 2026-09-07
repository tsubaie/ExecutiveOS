import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { lookup } from 'node:dns/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { Temporal } from '@js-temporal/polyfill';
const fixtures = JSON.parse(await readFile('tests/fixtures/tasks/preview.json', 'utf8'));
const { address } = await lookup('app');
const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${address}`] });
const evidence = [];
for (const locale of ['en', 'ar']) {
  const context = await browser.newContext({
    storageState: 'tmp/browser-state.json',
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:3000/tasks?view=all');
  async function api(path, method = 'GET', body) {
    const result = await page.evaluate(
      async ({ path, method, body }) => {
        const response = await fetch(`/api/v1/tasks${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'ExecutiveOS',
            'Idempotency-Key': crypto.randomUUID(),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return {
          status: response.status,
          body: response.status === 204 ? null : await response.json(),
        };
      },
      { path, method, body },
    );
    if (result.status >= 400) throw new Error(JSON.stringify(result));
    return result.body;
  }
  const fixture = fixtures[locale];
  const today = (await api('')).meta.today;
  const created = [];
  try {
    for (const [index, title] of fixture.titles.entries())
      created.push(
        (
          await api('', 'POST', {
            title,
            status: 'next_action',
            priority: index === 0 ? 'high' : 'medium',
            dueDate: Temporal.PlainDate.from(today)
              .add({ days: index - 1 })
              .toString(),
          })
        ).data,
      );
    for (const title of fixture.children) await api('', 'POST', { title, parentId: created[0].id });
    const messages = JSON.parse(await readFile(`src/core/i18n/messages/${locale}.json`, 'utf8'));
    for (const [viewport, size] of Object.entries({
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
    })) {
      await page.setViewportSize(size);
      for (const route of ['list', 'detail', 'create']) {
        await page.goto(
          `http://localhost:3000/tasks?view=all&q=${encodeURIComponent(fixture.prefix)}${route === 'detail' ? `&id=${created[0].id}` : route === 'create' ? '&new=1' : ''}`,
        );
        if (route === 'list') await page.locator('[data-row-id]').first().waitFor();
        else
          await page
            .getByRole('heading', {
              name: route === 'detail' ? fixture.titles[0] : messages.tasks.newTask,
              exact: true,
            })
            .waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(350);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const axe = await new AxeBuilder({ page }).analyze();
        const violations = axe.violations
          .filter((v) => ['serious', 'critical'].includes(v.impact))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
        evidence.push({ locale, viewport, route, overflow, violations, errors: [...errors] });
        await page.screenshot({
          path: `docs/screenshots/tasks-${route}-${locale}-${viewport}.png`,
        });
      }
    }
  } finally {
    for (const task of created) {
      const latest = (await api(`/${task.id}`)).data;
      await api(`/${task.id}`, 'DELETE', { revision: latest.revision });
    }
    await context.close();
  }
}
await browser.close();
await writeFile('tmp/tasks-accessibility.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
if (evidence.some((row) => row.overflow || row.violations.length || row.errors.length))
  process.exitCode = 1;
