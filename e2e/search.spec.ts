import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
// The catalogs hold ICU messages; the scenarios need the rendered string.
const fill = (message: string, values: Record<string, string>) =>
  message.replace(/\{(\w+)\}/gu, (_, key: string) => values[key] ?? '');
async function createTask(page: Page, title: string) {
  return page.evaluate(async (title) => {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ExecutiveOS',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ title }),
    });
    const body = await response.json();
    return { id: String(body.data.id), revision: Number(body.data.revision) };
  }, title);
}
async function trashTask(page: Page, task: { id: string; revision: number }) {
  await page.evaluate(async (task) => {
    await fetch(`/api/v1/tasks/${task.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ExecutiveOS',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ revision: task.revision }),
    });
  }, task);
}
for (const locale of ['en', 'ar'] as const) {
  const m = locale === 'ar' ? ar : en;
  // SEARCH-B11: the header carries a launcher, not a field. On a desktop it says the word beside
  // the icon; on a phone the icon alone. Either form and the chord open the same palette.
  test(`SEARCH-B11 the header search is a launcher with a word on a desktop and an icon on a phone (${locale})`, async ({
    page,
  }) => {
    await loginAs(page, locale);
    await page.goto('/home');
    const launcher = page.getByRole('button', { name: m.common.searchWorkspace, exact: true });
    const palette = page.getByRole('dialog');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(launcher).toBeVisible();
    await expect(launcher.getByText(m.common.searchOpen, { exact: true })).toBeVisible();
    // A launcher, not a field: nothing in the header is a text box until the palette opens.
    await expect(page.locator('header').getByRole('textbox')).toHaveCount(0);
    await launcher.click();
    await expect(palette.getByRole('searchbox', { name: m.common.search })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(launcher).toBeVisible();
    await expect(launcher.getByText(m.common.searchOpen, { exact: true })).toBeHidden();
    const box = await launcher.boundingBox();
    if (!box) throw new Error('Missing launcher geometry');
    expect(box.width).toBeLessThan(48);
    await page.keyboard.press('Control+k');
    await expect(palette.getByRole('searchbox', { name: m.common.search })).toBeVisible();
  });
  // SEARCH-B12: opened over a list, the palette's first row hands the phrase to that list.
  test(`SEARCH-B12 the palette opened over a list hands the phrase to that list (${locale})`, async ({
    page,
  }) => {
    await loginAs(page, locale);
    const title = `Hand-off ${crypto.randomUUID()}`;
    await page.goto('/tasks?view=all');
    const task = await createTask(page, title);
    try {
      await page.goto('/home');
      await page.keyboard.press('Control+k');
      const palette = page.getByRole('dialog');
      await palette.getByRole('searchbox', { name: m.common.search }).fill(title);
      // No list on the home page, so no hand-off row.
      await expect(
        palette.getByRole('button', {
          name: fill(m.common.searchScope, { module: m.common.tasks, query: title }),
        }),
      ).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.goto('/tasks?view=all');
      await page.keyboard.press('Control+k');
      await palette.getByRole('searchbox', { name: m.common.search }).fill(title);
      await palette
        .getByRole('button', {
          name: fill(m.common.searchScope, { module: m.common.tasks, query: title }),
        })
        .click();
      await expect(palette).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(title);
      await expect(
        page.getByRole('textbox', { name: m.tasks.searchList, exact: true }),
      ).toHaveValue(title);
      await expect(page.locator('[data-row-id]')).toHaveCount(1);
      await page.goBack();
      await expect(page).not.toHaveURL(/[?&]q=/);
    } finally {
      await trashTask(page, task);
    }
  });
}
