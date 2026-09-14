import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
for (const entityModule of ['notes', 'tasks']) {
for (const locale of ['en', 'ar']) {
  test(`EP-B15 EP-B22 Clear filters clears search and does not overlap it ${entityModule} ${locale}`, async ({ page }) => {
    await loginAs(page, locale);
    await page.goto(`/${entityModule}?view=all`);
    const messages = locale === 'ar' ? ar : en;
    const input = page.getByRole('textbox', { name: messages.common.search, exact: true });
    for (const width of [1076, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await input.fill('Search draft');
      await expect(page).toHaveURL(/q=Search/);
      const clear = page.getByRole('button', { name: messages.common.clear, exact: true }).first();
      const field = await input.boundingBox();
      const button = await clear.boundingBox();
      if (!field || !button) throw new Error('Missing toolbar geometry');
      const separate = field.x + field.width <= button.x || button.x + button.width <= field.x || field.y + field.height <= button.y || button.y + button.height <= field.y;
      expect(separate).toBe(true);
      await clear.click();
      await expect(input).toHaveValue('');
      await expect(page).not.toHaveURL(/[?&]q=/);
    }
  });
  test(`EP-B22 search icon stays outside the text field ${entityModule} ${locale}`, async ({ page }) => {
    await loginAs(page, locale);
    await page.goto(`/${entityModule}?view=all`);
    const input = page.getByRole('textbox', { name: (locale === 'ar' ? ar : en).common.search, exact: true });
    await expect(input).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await input.fill(locale === 'ar' ? 'ملاحظات' : 'Notes');
      const field = await input.boundingBox();
      const icon = await input.locator('..').locator('svg').boundingBox();
      expect(field).not.toBeNull();
      expect(icon).not.toBeNull();
      if (!field || !icon) throw new Error('Missing search geometry');
      expect(locale === 'ar' ? field.x + field.width <= icon.x : icon.x + icon.width <= field.x).toBe(true);
    }
  });
}
}
