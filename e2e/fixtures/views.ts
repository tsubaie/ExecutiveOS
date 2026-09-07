import { expect, type Page } from '@playwright/test';
import en from '../../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../../src/core/i18n/messages/ar.json' with { type: 'json' };
// Selects an entity view whether the rail is visible (wide desktop) or folded into the filter sheet.
export async function selectView(page: Page, locale: string, name: RegExp) {
  const messages = locale === 'ar' ? ar : en;
  const rail = page.getByRole('button', { name }).first();
  if (await rail.isVisible()) {
    await rail.click();
    return;
  }
  await page.getByRole('button', { name: messages.common.filter, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name }).click();
  await expect(dialog).toBeHidden();
}
