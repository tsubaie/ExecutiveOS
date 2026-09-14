import { expect, test } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };

for (const locale of ['en', 'ar']) {
  test(`ADMIN-B24 save, reload, replace and remove an API key (${locale})`, async ({
    page,
  }, testInfo) => {
    const messages = locale === 'ar' ? ar : en;
    let saved = false;
    let fail = false;
    await page.route('**/api/v1/admin/ai/credentials', async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        expect(route.request().postDataJSON()).toEqual({
          apiKey: 'fixture-key',
        });
        if (fail) {
          await route.fulfill({
            status: 500,
            json: {
              error: {
                code: 'internal',
                message: 'Save failed',
                details: {},
                requestId: 'fixture',
              },
            },
          });
          return;
        }
        saved = true;
      }
      if (method === 'DELETE') saved = false;
      await route.fulfill({
        json: { data: { provider: 'openrouter', source: saved ? 'saved' : 'none' } },
      });
    });
    await loginAs(page, locale);
    await page.goto('/admin/ai');
    const key = page.locator('input[type=password]');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(key).toHaveAttribute('type', 'password');
    await key.fill('fixture-key');
    await page.getByRole('button', { name: messages.admin.aiSaveKey, exact: true }).click();
    await expect(page.getByText(messages.admin.aiKeySaved, { exact: true })).toBeVisible();
    await expect(key).toHaveValue('');
    await expect(page.getByText(messages.admin.aiKeySaveSuccess, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(messages.admin.aiKeySaved, { exact: true })).toBeVisible();
    await expect(key).toHaveValue('');
    await page.screenshot({ path: testInfo.outputPath('ai-key-saved.png'), fullPage: true });
    fail = true;
    await key.fill('fixture-key');
    await page.getByRole('button', { name: messages.admin.aiReplaceKey, exact: true }).click();
    await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: messages.admin.aiRemoveKey, exact: true }).click();
    await expect(page.getByText(messages.admin.aiKeyMissing, { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
