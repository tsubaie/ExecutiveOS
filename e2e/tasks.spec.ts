import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
const created = new WeakMap<Page, Promise<string>[]>();
test.beforeEach(async ({ page }) => {
  const records: Promise<string>[] = [];
  created.set(page, records);
  page.on('response', (response) => {
    if (
      response.status() === 201 &&
      /\/api\/v1\/tasks(?:\/group)?$/.test(new URL(response.url()).pathname)
    )
      records.push(response.json().then((body) => String(body.data.id)));
  });
});
test.afterEach(async ({ page }) => {
  for (const id of await Promise.all(created.get(page) ?? [])) {
    const current = await api(page, `/${id}`);
    if (current.status === 200)
      await api(page, `/${id}`, 'DELETE', { revision: current.body.data.revision });
  }
});
async function api(page: Page, path: string, method = 'GET', body?: object, key?: string) {
  return page.evaluate(
    async ({ path, method, body, key }) => {
      const response = await fetch(`/api/v1/tasks${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': key ?? crypto.randomUUID(),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body:
          response.status === 204
            ? { opId: response.headers.get('x-op-id') }
            : await response.json(),
      };
    },
    { path, method, body, key },
  );
}
for (const locale of ['en', 'ar'])
  test(`TASKS-A01 TASKS-A03 TASKS-A04 TASKS-B08 TASKS-B15 create edit subtasks complete restore ${locale}`, async ({
    page,
  }) => {
    const m = locale === 'ar' ? ar : en;
    await loginAs(page, locale);
    await page.goto('/tasks?view=inbox');
    await expect(page.getByRole('heading', { name: m.common.tasks, exact: true })).toBeVisible();
    const title = `Office review ${crypto.randomUUID()}`;
    await page.getByRole('button', { name: m.common.create, exact: true }).first().click();
    await page.getByLabel(m.tasks.title, { exact: true }).fill(title);
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page).toHaveURL(/id=/);
    const id = new URL(page.url()).searchParams.get('id')!;
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByLabel(m.tasks.priority, { exact: true }).last().selectOption('high');
    await expect(page.getByRole('status')).toContainText(m.common.saved);
    await page.getByLabel(m.tasks.description, { exact: true }).fill('Quarterly office review');
    await page.getByRole('heading', { name: title, exact: true }).click();
    await expect
      .poll(async () => (await api(page, `/${id}`)).body.data.description)
      .toBe('Quarterly office review');
    expect((await api(page, `/${id}`)).body.data.priority).toBe('high');
    await page.getByLabel(m.tasks.subtaskTitle, { exact: true }).fill('Prepare agenda');
    await page
      .locator('aside.entity-detail')
      .getByRole('button', { name: m.common.create, exact: true })
      .click();
    await expect(page.getByLabel(m.tasks.subtaskTitle, { exact: true }).first()).toHaveValue(
      'Prepare agenda',
    );
    const checkbox = page.locator('aside.entity-detail').getByRole('checkbox').first();
    await checkbox.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: m.tasks.completeAll, exact: true }).click();
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(
      page.locator('aside.entity-detail').getByLabel(m.tasks.status, { exact: true }),
    ).toHaveValue('next_action');
    await page
      .locator('aside.entity-detail')
      .getByRole('button', { name: m.common.delete, exact: true })
      .last()
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: m.common.delete, exact: true })
      .click();
    await expect(page).not.toHaveURL(/id=/);
    await page.goto(`/tasks?view=trash&id=${id}`);
    await page
      .locator('aside.entity-detail')
      .getByRole('button', { name: m.common.restore, exact: true })
      .click();
    await expect(page).not.toHaveURL(/id=/);
    await page.goto(`/tasks?view=all&id=${id}`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `docs/screenshots/tasks-detail-${locale}-mobile.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: m.common.close, exact: true }).click();
    await expect(page.locator(`[data-row-id="${id}"]`)).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/tasks-list-${locale}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: `docs/screenshots/tasks-list-${locale}-desktop.png`,
      fullPage: true,
    });
    await page.locator(`[data-row-id="${id}"]`).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/tasks-detail-${locale}-desktop.png`,
      fullPage: true,
    });
  });
test('TASKS-A05 TASKS-B09 group selected tasks through framework selection', async ({ page }) => {
  await loginAs(page, 'en');
  const prefix = `Group ${crypto.randomUUID()}`;
  const children = [];
  for (const suffix of ['One', 'Two', 'Three'])
    children.push((await api(page, '', 'POST', { title: `${prefix} ${suffix}` })).body.data);
  await page.goto(`/tasks?view=all&q=${encodeURIComponent(prefix)}`);
  await page.getByRole('button', { name: en.common.select, exact: true }).click();
  for (const child of children)
    await page.getByRole('checkbox', { name: `Select ${child.title}`, exact: true }).click();
  await page.getByRole('button', { name: en.tasks.group, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(en.tasks.title, { exact: true })
    .fill(`${prefix} Parent`);
  await page.getByRole('dialog').getByRole('button', { name: en.tasks.group, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[data-row-id]')).toHaveCount(1);
  await page.locator('[data-row-id]').click();
  await expect(
    page.locator('aside.entity-detail').getByLabel(en.tasks.subtaskTitle, { exact: true }),
  ).toHaveCount(4);
});
test('TASKS-A09 EP-B08 stale editor offers reload and reapply without resetting other fields', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const task = (
    await api(page, '', 'POST', { title: `Conflict ${crypto.randomUUID()}`, priority: 'high' })
  ).body.data;
  await page.goto(`/tasks?view=all&id=${task.id}`);
  await expect(page.getByLabel(en.tasks.title, { exact: true })).toHaveValue(task.title);
  await api(page, `/${task.id}`, 'PATCH', {
    revision: task.revision,
    description: 'Another editor changed this',
  });
  await page.getByLabel(en.tasks.title, { exact: true }).fill(`${task.title} edited`);
  // The title is the heading itself, so blur it by clicking a non-field element in the panel.
  await page
    .locator('aside.entity-detail')
    .getByRole('heading', { name: en.tasks.subtasks, exact: true })
    .click();
  await expect(page.getByRole('button', { name: en.common.reapply, exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.common.reapply, exact: true }).click();
  await expect(page.getByRole('status')).toContainText(en.common.saved);
  const saved = (await api(page, `/${task.id}`)).body.data;
  expect(saved.title).toBe(`${task.title} edited`);
  expect(saved.description).toBe('Another editor changed this');
  expect(saved.priority).toBe('high');
});
test('TASKS-A07 TASKS-B02 API authorization validation idempotency and disabled AI', async ({
  page,
  request,
}) => {
  expect((await request.get('/api/v1/tasks')).status()).toBe(401);
  await loginAs(page, 'en');
  expect((await api(page, '', 'POST', { title: '' })).status).toBe(400);
  const key = crypto.randomUUID();
  const first = await api(page, '', 'POST', { title: 'Idempotent task' }, key);
  const replay = await api(page, '', 'POST', { title: 'Idempotent task' }, key);
  expect(first.status).toBe(201);
  expect(replay.body.data.id).toBe(first.body.data.id);
  expect((await api(page, '', 'POST', { title: 'Different' }, key)).status).toBe(409);
  const task = first.body.data;
  expect(
    (await api(page, `/${task.id}`, 'PATCH', { revision: 1, status: 'completed' })).status,
  ).toBe(422);
  expect((await api(page, `/${task.id}/breakdown`, 'POST', { revision: 1 })).status).toBe(503);
  expect((await api(page, `/${crypto.randomUUID()}`)).status).toBe(404);
});
test('TASKS-B08 TASKS-I04 reorder children and restore an independently deleted child from detail', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const parent = (await api(page, '', 'POST', { title: `Reorder ${crypto.randomUUID()}` })).body
    .data;
  const children = [];
  for (const title of ['Prepare materials', 'Confirm attendance', 'Review agenda'])
    children.push((await api(page, '', 'POST', { title, parentId: parent.id })).body.data);
  await page.goto(`/tasks?view=all&id=${parent.id}`);
  await expect(
    page.locator('aside.entity-detail').getByRole('heading', { name: parent.title }),
  ).toBeVisible();
  await page.getByRole('button', { name: en.tasks.moveDown, exact: true }).first().click();
  await expect(page.getByLabel(en.tasks.subtaskTitle, { exact: true }).first()).toHaveValue(
    'Confirm attendance',
  );
  const current = (await api(page, `/${children[0].id}`)).body.data;
  await api(page, `/${current.id}`, 'DELETE', { revision: current.revision });
  await page.reload();
  await page.locator('aside.entity-detail summary').click();
  await page
    .locator('aside.entity-detail details')
    .getByRole('button', { name: en.common.restore, exact: true })
    .click();
  await expect(page.locator('aside.entity-detail details')).toHaveCount(0);
  await expect(page.getByLabel(en.tasks.subtaskTitle, { exact: true })).toHaveCount(4);
});
test('TASKS-B10 TASKS-B15 HOME-B01 assigned work appears in People and Home', async ({ page }) => {
  await loginAs(page, 'en');
  const owners = await page.evaluate(
    async () => (await (await fetch('/api/v1/people?view=assignable')).json()).data,
  );
  const task = (
    await api(page, '', 'POST', {
      title: `Assigned ${crypto.randomUUID()}`,
      ownerId: owners[0].id,
      status: 'waiting_on',
    })
  ).body.data;
  await page.goto(`/people?id=${owners[0].id}`);
  await expect(page.getByRole('link', { name: task.title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: task.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`id=${task.id}`));
  await page.goto('/home');
  await expect(page.getByRole('link', { name: task.title, exact: true })).toBeVisible();
});

for (const locale of ['en', 'ar']) {
  test(`EP-B03 EP-B06 EP-B07 EP-B08 EP-B15 EP-B17 filters, touch targets and focus ${locale}`, async ({
    page,
  }) => {
    const m = locale === 'ar' ? ar : en;
    await loginAs(page, locale);
    const task = (
      await api(page, '', 'POST', { title: `UX ${crypto.randomUUID()}`, priority: 'low' })
    ).body.data;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tasks?view=all&q=${encodeURIComponent(task.title)}`);
    await expect(page.getByRole('button', { name: m.tasks.group, exact: true })).toBeHidden();
    const toggle = page.getByRole('checkbox', {
      name: m.tasks.completeNamed.replace('{name}', task.title),
      exact: true,
    });
    const bounds = await toggle.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    const row = page.locator(`[data-row-id="${task.id}"]`);
    expect((await row.boundingBox())?.y).toBeLessThan(320);
    await row.focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('checkbox', {
        name: m.common.selectItem.replace('{name}', task.title),
        exact: true,
      }),
    ).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/sel=/);
    await row.click();
    await expect(page.getByRole('button', { name: m.common.previous, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: m.common.next, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: m.common.close, exact: true }).click();
    await expect(row).toBeFocused();
    await page.goto(`/tasks?view=all&priority=urgent&id=${task.id}`);
    await expect(page.getByText(m.common.outside, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: m.common.showAll }).click();
    await expect(page).toHaveURL(new RegExp(`view=all&id=${task.id}`));
    await page.getByRole('button', { name: m.common.close, exact: true }).click();
    await page.getByRole('button', { name: m.common.filter, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel(m.tasks.priority, { exact: true })
      .selectOption('urgent');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: m.common.close, exact: true })
      .click();
    await expect(page).toHaveURL(/priority=urgent/);
    await page.getByRole('button', { name: m.common.clear, exact: true }).first().click();
    await expect(page).not.toHaveURL(/priority=/);
    for (const width of [320, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/tasks?view=all&id=${task.id}`);
      await expect(page.getByRole('heading', { name: task.title, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      if (width >= 1024)
        expect(
          (await page.locator('[data-entity-list]').boundingBox())?.width,
        ).toBeGreaterThanOrEqual(300);
    }
  });
}

test('EP-B10 EP-B11 queued save failure blocks view changes and preserves the draft @desktop', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const task = (await api(page, '', 'POST', { title: `UX save ${crypto.randomUUID()}` })).body.data;
  await page.goto(`/tasks?view=all&id=${task.id}`);
  const title = page.getByLabel(en.tasks.title, { exact: true });
  await title.fill('');
  await page.getByLabel(en.tasks.description, { exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: en.common.titleRequired })).toBeVisible();
  await title.fill(`${task.title} edited`);
  await page.route(`**/api/v1/tasks/${task.id}`, async (route) => {
    if (route.request().method() === 'PATCH') await route.abort();
    else await route.continue();
  });
  await page.getByLabel(en.tasks.description, { exact: true }).click();
  await page.getByRole('button', { name: en.tasks.inbox, exact: false }).first().click();
  await expect(page.getByRole('dialog')).toContainText(en.common.unsaved);
  await expect(title).toHaveValue(`${task.title} edited`);
  await page.unroute(`**/api/v1/tasks/${task.id}`);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: en.common.retry, exact: true })
    .click();
  await expect(page).toHaveURL(/view=inbox/);
  expect((await api(page, `/${task.id}`)).body.data.title).toBe(`${task.title} edited`);
});

test('EP-B01 EP-B02 search keeps typing focus, debounces and follows browser history', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const title = `UX search ${crypto.randomUUID()}`;
  await api(page, '', 'POST', { title });
  await page.goto('/tasks?view=all');
  const search = page.getByRole('textbox', { name: en.common.search });
  await search.pressSequentially(title, { delay: 10 });
  await expect(search).toBeFocused();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(title);
  await expect(page.locator('[data-row-id]')).toHaveCount(1);
  await page.locator('[data-row-id]').click();
  await expect(page).toHaveURL(/id=/);
  await page.goBack();
  await expect(search).toHaveValue(title);
  await expect(page).not.toHaveURL(/id=/);
});
