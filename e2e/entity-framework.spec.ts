import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures/auth';

// EP-B23: opening a record has to make that record the subject of the page. Every part of this is
// CSS, and the part that kept failing was a cascade problem rather than a missing rule, so the
// assertions read computed style from a real browser rather than class names from a render.
async function createTask(page: Page, title: string) {
  const created = await page.evaluate(async (name) => {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ExecutiveOS',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ title: name }),
    });
    return response.json();
  }, title);
  return String(created.data.id);
}

test('EP-B23 the page hands the open record the foreground @desktop', async ({ page }) => {
  await loginAs(page, 'en');
  const prefix = `Focus ${crypto.randomUUID()}`;
  const id = await createTask(page, `${prefix} first`);
  await createTask(page, `${prefix} second`);
  await page.goto(`/tasks?view=all&q=${encodeURIComponent(prefix)}`);
  const row = page.locator(`[data-row-id="${id}"]`);
  await expect(row).toBeVisible();

  // Open the record with the pointer left where it will still be over the list once the list
  // narrows, which is the situation the hold exists for: clicking a row is how a record is opened,
  // so the hover escape would otherwise cancel the softening at that exact moment.
  await row.click();
  await page.waitForSelector('.entity-detail');
  expect(
    await page.evaluate(() => {
      const list = document.querySelector('[data-entity-list]');
      return list ? getComputedStyle(list).animationName : null;
    }),
  ).toBe('hold-dim');

  // Soft straight away, before any pointer movement: this is the moment the hover escape used to
  // cancel, because opening a record is a click on a row.
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector('[data-entity-list]')!).filter),
  ).toContain('blur(');

  // The rest is the resting state, read once the row's own colour transition has settled.
  await page.waitForTimeout(1500);
  const planes = await page.evaluate(() => {
    const style = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    const box = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().width ?? 0;
    const active = document.activeElement as HTMLElement | null;
    return {
      listBg: style('[data-entity-list]')?.backgroundColor ?? null,
      panelBg: style('.entity-detail')?.backgroundColor ?? null,
      panelShadow: style('.entity-detail')?.boxShadow ?? null,
      currentBg: style('.entity-row[data-current]')?.backgroundColor ?? null,
      listWidth: box('[data-entity-list]'),
      panelWidth: box('.entity-detail'),
      focus: {
        tag: active?.tagName ?? null,
        tabIndex: active?.getAttribute('tabindex') ?? null,
        outline: active ? getComputedStyle(active).outlineStyle : null,
      },
    };
  });
  // One raised plane: the panel keeps the surface tone, the list drops to the page ground.
  expect(planes.listBg).not.toBe(planes.panelBg);
  expect(planes.panelShadow).not.toBe('none');
  // The record is the subject, so it carries the wider column.
  expect(planes.panelWidth).toBeGreaterThan(planes.listWidth);
  // The selected row keeps its place with the edge bar alone; the tinted ground goes.
  expect(planes.currentBg).toBe('rgba(0, 0, 0, 0)');
  // The heading is focused so the record is announced, but it is not tabbable and draws no ring.
  expect(planes.focus).toEqual({ tag: 'H2', tabIndex: '-1', outline: 'none' });
});
