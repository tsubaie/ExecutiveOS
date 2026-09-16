import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
for (const entityModule of ['notes', 'tasks'] as const) {
for (const locale of ['en', 'ar'] as const) {
  // EP-B41: the field is named by its module, so the scenarios look it up by that name.
  const messages = locale === 'ar' ? ar : en;
  const label = { notes: messages.notes.searchList, tasks: messages.tasks.searchList }[entityModule];
  test(`EP-B15 EP-B22 Clear filters clears search and does not overlap it ${entityModule} ${locale}`, async ({ page }) => {
    await loginAs(page, locale);
    await page.goto(`/${entityModule}?view=all`);
    const input = page.getByRole('textbox', { name: label, exact: true });
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
    const input = page.getByRole('textbox', { name: label, exact: true });
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
  test(`EP-B41 the field names its module and the no-matches state hands the phrase to the workspace search ${entityModule} ${locale}`, async ({ page }) => {
    await loginAs(page, locale);
    await page.goto(`/${entityModule}?view=all`);
    const input = page.getByRole('textbox', { name: label, exact: true });
    await expect(input).toHaveAttribute('placeholder', label);
    const phrase = `zzqx-${crypto.randomUUID()}`;
    await input.fill(phrase);
    await expect(page).toHaveURL(/q=zzqx/);
    // The header launcher carries the same name on purpose; the empty state's own control is the one under test.
    await page.getByRole('main').getByRole('button', { name: messages.common.searchWorkspace, exact: true }).click();
    const palette = page.getByRole('dialog');
    await expect(palette.getByRole('searchbox', { name: messages.common.search })).toHaveValue(phrase);
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(input).toHaveValue(phrase);
  });
}
}
