import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// Bilingual, two-viewport screenshots of the Notes list, detail and create surfaces with an axe
// pass on each, using fictional records that are trashed afterwards. Runs inside the tooling
// container against the preview app (docs/history/NOTES-HANDOFF.md).
await mkdir('tmp/screenshots', { recursive: true });
const fixtures = JSON.parse(await readFile('tests/fixtures/notes/preview.json', 'utf8'));
// Against the Compose preview the `app` host is mapped to localhost and the saved browser state
// is reused; inside the tooling container the standalone server answers on localhost directly
// and the browser-test account signs in through the login form (`--local`).
const address = process.argv.includes('--local')
  ? null
  : await lookup('app').then(
      (hit) => hit.address,
      () => null,
    );
const browser = await chromium.launch({
  args: address ? [`--host-resolver-rules=MAP localhost ${address}`] : [],
});
const state = address
  ? await readFile('tmp/browser-state.json', 'utf8').then(
      () => 'tmp/browser-state.json',
      () => undefined,
    )
  : undefined;
async function signIn(page) {
  const account = JSON.parse(await readFile('e2e/.auth/credentials.json', 'utf8'));
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/home/);
}
const evidence = [];
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
for (const locale of ['en', 'ar']) {
  const context = await browser.newContext({
    ...(state ? { storageState: state } : {}),
    viewport: viewports.desktop,
  });
  await context.addCookies([{ name: 'eos_locale', value: 'en', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!state) await signIn(page);
  await context.addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
  await page.goto('http://localhost:3000/notes?view=all');
  async function api(resource, path, method = 'GET', body) {
    const result = await page.evaluate(
      async ({ resource, path, method, body }) => {
        const response = await fetch(`/api/v1/${resource}${path}`, {
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
      { resource, path, method, body },
    );
    if (result.status >= 400) throw new Error(JSON.stringify(result));
    return result.body;
  }
  const fixture = fixtures[locale];
  const created = { notes: [], tasks: [], people: [] };
  try {
    for (const name of fixture.people)
      created.people.push(
        (
          await api('people', '', 'POST', {
            fullName: name,
            kind: 'external',
            isAssignable: false,
            tags: [],
            email: null,
            phone: null,
            notes: null,
            displayName: null,
            honorific: null,
            organization: null,
            roleTitle: null,
            userId: null,
            confirmDuplicate: true,
          })
        ).data,
      );
    for (const [index, title] of fixture.titles.entries())
      created.notes.push(
        (
          await api('notes', '', 'POST', {
            title,
            type: fixture.types[index],
            tags: index === 0 ? fixture.tags : [],
            content: index === 0 ? fixture.content : '',
            participantIds: created.people.slice(0, index === 0 ? 2 : 1).map((p) => p.id),
          })
        ).data,
      );
    for (const title of fixture.tasks)
      created.tasks.push(
        (await api('tasks', '', 'POST', { title, sourceNoteId: created.notes[0].id })).data,
      );
    const messages = JSON.parse(await readFile(`src/core/i18n/messages/${locale}.json`, 'utf8'));
    for (const [viewport, size] of Object.entries(viewports)) {
      await page.setViewportSize(size);
      for (const route of ['list', 'detail', 'create']) {
        const suffix =
          route === 'detail' ? `&id=${created.notes[0].id}` : route === 'create' ? '&new=1' : '';
        await page.goto(
          `http://localhost:3000/notes?view=all&q=${encodeURIComponent(fixture.prefix)}${suffix}`,
        );
        if (route === 'list') await page.locator('[data-row-id]').first().waitFor();
        else if (route === 'create')
          await page.getByRole('heading', { name: messages.notes.newNote, exact: true }).waitFor();
        else await page.getByLabel(messages.notes.title, { exact: true }).waitFor();
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
        await page.screenshot({ path: `tmp/screenshots/notes-${route}-${locale}-${viewport}.png` });
      }
    }
  } finally {
    for (const task of created.tasks) {
      const latest = (await api('tasks', `/${task.id}`)).data;
      await api('tasks', `/${task.id}`, 'DELETE', { revision: latest.revision });
    }
    for (const note of created.notes) {
      const latest = (await api('notes', `/${note.id}`)).data;
      await api('notes', `/${note.id}`, 'DELETE', { revision: latest.revision });
    }
    for (const person of created.people) {
      const latest = (await api('people', `/${person.id}`)).data;
      await api('people', `/${person.id}`, 'DELETE', { revision: latest.revision });
    }
    await context.close();
  }
}
await browser.close();
await writeFile('tmp/notes-accessibility.json', JSON.stringify(evidence, null, 2));
process.stdout.write(JSON.stringify(evidence) + '\n');
if (evidence.some((row) => row.overflow || row.violations.length || row.errors.length))
  process.exitCode = 1;
