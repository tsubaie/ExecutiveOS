import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };

for (const locale of ['en', 'ar']) {
  const m = locale === 'ar' ? ar : en;
  test(`COMM-A01 COMM-A04 shared committee create and linked task workflow ${locale}`, async ({ page }) => {
    await loginAs(page, locale);
    const name = `Committee ${crypto.randomUUID()}`;
    await page.goto(`/committees?view=all&q=${encodeURIComponent(name)}`);
    await page.getByRole('button', { name: m.common.create, exact: true }).click();
    await page.getByLabel(m.committees.name, { exact: true }).fill(name);
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page).toHaveURL(/id=/);
    const committeeId = new URL(page.url()).searchParams.get('id');
    const detail = page.locator('aside.entity-detail');
    await expect(detail.getByLabel(m.committees.name, { exact: true })).toHaveValue(name);
    await detail.getByRole('tab', { name: m.committees.tasks, exact: true }).click();
    await detail.getByRole('button', { name: m.common.create, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const title = `Action ${crypto.randomUUID()}`;
    await dialog.getByLabel(m.tasks.title, { exact: true }).fill(title);
    await expect(dialog.getByLabel(m.committees.committee, { exact: true })).toContainText(name);
    await dialog.getByRole('button', { name: m.common.create, exact: true }).click();
    await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.goto(`/tasks?view=all&committeeId=${committeeId}`);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    await page.goto(`/committees?view=all&q=${encodeURIComponent(name)}`);
    await page.getByRole('button', { name: m.common.create, exact: true }).click();
    await page.getByLabel(m.committees.name, { exact: true }).fill(name);
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page.getByText(m.committees.duplicateName, { exact: true })).toBeVisible();
  });
}
