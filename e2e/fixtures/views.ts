import { expect, type Page } from '@playwright/test';
import en from '../../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../../src/core/i18n/messages/ar.json' with { type: 'json' };
// Selects an entity view whether the rail is visible (wide desktop) or folded into the filter sheet.
export async function selectView(page: Page, locale: string, name: RegExp) {
  const messages = locale === 'ar' ? ar : en;
  // Scoped to the rail, not the page: a view name is ordinary words, so an unscoped lookup also
  // matches a record whose title happens to contain them. A note called "Trash <id>" made
  // `.first()` resolve to its own row wherever the rail was absent, and the fixture then clicked
  // the row it was supposed to be navigating away from.
  const rail = page.locator('.entity-rail').getByRole('button', { name }).first();
  if (await rail.isVisible()) {
    await rail.click();
    return;
  }
  await page.getByRole('button', { name: messages.common.filter, exact: true }).click();
  // The app's own dialog surface, not any `role="dialog"`: a toast is one too (Base UI makes each
  // toast a navigable region), so a bare role lookup matches the receipt of whatever the reader
  // just did as readily as the filter sheet.
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name }).click();
  await expect(dialog).toBeHidden();
}
