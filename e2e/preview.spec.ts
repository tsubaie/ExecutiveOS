import { test, expect } from '@playwright/test';
import { loginAs, credentials } from './fixtures/auth';
import { selectView } from './fixtures/views';
import { z } from 'zod';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
for (const locale of ['en', 'ar'])
  test(`PEOPLE-B01 PEOPLE-B02 PEOPLE-B03 PEOPLE-B06 PEOPLE-A05 EP-B01 EP-B05 EP-B08 EP-B09 create edit duplicate trash restore (${locale})`, async ({
    page,
  }) => {
    const m = locale === 'ar' ? ar : en;
    await loginAs(page, locale);
    await page.goto('/people');
    await expect(page.getByRole('heading', { name: m.common.people, exact: true })).toBeVisible();
    const name = `Preview ${crypto.randomUUID()}`;
    await page.getByRole('button', { name: m.common.create, exact: true }).click();
    await expect(page).toHaveURL(/new=1/);
    await page.getByLabel(m.people.fullName, { exact: true }).fill(name);
    await page.getByRole('checkbox', { name: m.people.isAssignable }).click();
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page).toHaveURL(/id=/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByLabel(m.people.organization, { exact: true }).fill('Preview Foundation');
    await page.getByLabel(m.people.roleTitle, { exact: true }).click();
    await expect(page.getByRole('status')).toContainText(m.common.saved);
    await page.reload();
    await expect(page.getByLabel(m.people.organization, { exact: true })).toHaveValue(
      'Preview Foundation',
    );
    await page.getByRole('button', { name: m.common.close, exact: true }).click();
    await page.getByRole('button', { name: m.common.create, exact: true }).click();
    await page.getByLabel(m.people.fullName, { exact: true }).fill(name);
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: m.people.duplicateTitle })).toBeVisible();
    await page.getByRole('button', { name: m.common.cancel, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: m.common.close, exact: true }).click();
    await page.getByRole('button').filter({ hasText: name }).click();
    await page.getByRole('button', { name: m.common.delete, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: m.common.delete, exact: true })
      .click();
    await expect(page).not.toHaveURL(/id=/);
    await selectView(page, locale, new RegExp(m.common.trash));
    await page.getByRole('button').filter({ hasText: name }).click();
    await page.getByRole('button', { name: m.common.restore, exact: true }).click();
    await expect(page).not.toHaveURL(/id=/);
    await selectView(page, locale, new RegExp(m.common.all));
    await expect(page.getByRole('button').filter({ hasText: name })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole('button').filter({ hasText: name }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
test('ADMIN-A01 setup cannot run a second time; origin guard and private session boundary', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const account = await credentials();
  const results = await page.evaluate(async (account) => {
    const body = {
      // Any token proves the point: an initialized workspace refuses setup before checking it.
      setupToken: account.setupToken ?? 'already-initialized',
      email: account.email,
      password: account.password,
      name: account.name,
      workspaceName: 'Second Workspace',
      locale: 'en',
      timezone: 'UTC',
      principalName: '',
    };
    const repeat = await fetch('/api/v1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ExecutiveOS' },
      body: JSON.stringify(body),
    });
    const origin = await fetch('/api/v1/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return { repeat: repeat.status, origin: origin.status };
  }, account);
  expect(results).toEqual({ repeat: 409, origin: 403 });
});
test('ADMIN-B04 last active administrator cannot be deactivated', async ({ page }) => {
  await loginAs(page, 'en');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});
test('HOME-B02 HOME-A03 disabled sections collapse and AI review section is absent', async ({
  page,
}) => {
  await loginAs(page, 'en');
  await expect(page.getByText('Module not enabled', { exact: true })).toHaveCount(4);
  await expect(page.getByText('Pending AI reviews', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: /Your people directory/ }).click();
  await expect(page).toHaveURL(/people/);
});
test('idempotency replay returns one entity; changed payload with the same key conflicts', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const result = await page.evaluate(async () => {
    const key = crypto.randomUUID();
    const body = {
      fullName: 'Idempotency ' + crypto.randomUUID(),
      displayName: null,
      honorific: null,
      organization: null,
      roleTitle: null,
      kind: 'external',
      email: null,
      phone: null,
      notes: null,
      tags: [],
      isAssignable: false,
      userId: null,
    };
    const send = (input: typeof body) =>
      fetch('/api/v1/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(input),
      });
    const first = await send(body);
    const replay = await send(body);
    const conflict = await send({ ...body, fullName: body.fullName + ' changed' });
    return {
      first: await first.text(),
      replay: await replay.text(),
      statuses: [first.status, replay.status, conflict.status],
    };
  });
  expect(JSON.parse(result.first)).toEqual(JSON.parse(result.replay));
  expect(result.statuses).toEqual([201, 201, 409]);
  // Leave nothing behind: accumulated rows would push other scenarios' people past the first page.
  const created = JSON.parse(result.first).data;
  await page.evaluate(
    async ({ id, revision }) => {
      await fetch(`/api/v1/people/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ revision }),
      });
    },
    { id: created.id, revision: created.revision },
  );
});
test('ADMIN-B12 backup created from the admin page completes as a fenced job', async ({ page }) => {
  await loginAs(page, 'en');
  await page.goto('/admin/backups');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/admin/backups') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create backup', exact: true }).click();
  const job = z.object({ data: z.object({ id: z.string() }) }).parse(await (await response).json());
  await expect(page.getByText(job.data.id, { exact: true })).toBeVisible({ timeout: 20000 });
});
