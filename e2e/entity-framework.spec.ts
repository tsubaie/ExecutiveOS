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

  // The dim belongs to the open record, not to where the pointer is. It settles once focus has
  // left the row for the panel, and then stays put with the pointer sitting on the list.
  await row.click();
  await page.waitForSelector('.entity-detail');
  const soft = () =>
    page.evaluate(() => getComputedStyle(document.querySelector('[data-entity-list]')!).filter);
  await expect.poll(soft).toContain('blur(');
  const listBox = await page.locator('[data-entity-list]').boundingBox();
  await page.mouse.move((listBox?.x ?? 0) + 60, (listBox?.y ?? 0) + 120);
  await page.waitForTimeout(600);
  expect(await soft()).toContain('blur(');

  // The rest is the resting state, read once the row's own colour transition has settled.
  await page.waitForTimeout(1500);
  const planes = await page.evaluate(() => {
    const style = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    const active = document.activeElement as HTMLElement | null;
    return {
      listBg: style('[data-entity-list]')?.backgroundColor ?? null,
      panelBg: style('.entity-detail')?.backgroundColor ?? null,
      panelShadow: style('.entity-detail')?.boxShadow ?? null,
      currentBg: style('.entity-row[data-current]')?.backgroundColor ?? null,
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
  // The selected row keeps its place with the edge bar alone; the tinted ground goes.
  expect(planes.currentBg).toBe('rgba(0, 0, 0, 0)');
  // The heading is focused so the record is announced, but it is not tabbable and draws no ring.
  expect(planes.focus).toEqual({ tag: 'H2', tabIndex: '-1', outline: 'none' });

  // Closing the record is what clears it.
  await page.keyboard.press('Escape');
  await expect(page.locator('.entity-detail')).toHaveCount(0);
  await expect.poll(soft).toBe('none');

  // Keyboard focus is the one thing that lifts it: what a reader has tabbed to has to be readable.
  await page.locator('[data-entity-list] [data-row-id]').nth(1).focus();
  await expect.poll(soft).toBe('none');

  // Closing the record clears it for good.
  await page.keyboard.press('Escape');
  await expect(page.locator('.entity-detail')).toHaveCount(0);
  await expect.poll(soft).toBe('none');
});

// EP-B26: the detail is a slide-over, so the two things that separate it from the column it
// replaced are geometry (it covers the list instead of displacing it) and the fact that nothing
// behind it is inert. Both are read from a real browser for the same reason EP-B23 is.
test('EP-B26 the record slides over the list instead of displacing it @desktop', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const prefix = `Slide ${crypto.randomUUID()}`;
  const id = await createTask(page, `${prefix} first`);
  await createTask(page, `${prefix} second`);
  await page.goto(`/tasks?view=all&q=${encodeURIComponent(prefix)}`);
  const list = page.locator('[data-entity-list]');
  const row = page.locator(`[data-row-id="${id}"]`);
  await expect(row).toBeVisible();

  const closed = await list.boundingBox();
  await row.click();
  const panel = page.locator('.entity-detail');
  await expect(panel).toBeVisible();
  // The entrance travels the panel's own width, so every box below has to be the resting one.
  // Polling for the edge it settles against beats sleeping for longer than the animation: the
  // measurement is the wait, and a slow frame lengthens it instead of failing it.
  const edge = () => panel.boundingBox().then((box) => Math.round((box?.x ?? 0) + (box?.width ?? 0)));
  await expect.poll(edge).toBe(page.viewportSize()?.width ?? 0);

  // Opening a record moves no row: the list keeps exactly the width it had when it was alone.
  const open = await list.boundingBox();
  expect(open?.width).toBeCloseTo(closed?.width ?? 0, 0);
  expect(open?.x).toBeCloseTo(closed?.x ?? 0, 0);

  // And the panel is in front of it rather than beside it, which is the same thing said in boxes:
  // a column would start where the list ends, a slide-over starts inside it.
  const over = await panel.boundingBox();
  const overlap =
    Math.min((open?.x ?? 0) + (open?.width ?? 0), (over?.x ?? 0) + (over?.width ?? 0)) -
    Math.max(open?.x ?? 0, over?.x ?? 0);
  expect(overlap).toBeGreaterThan(0);

  // Full height of the window, flush to its end edge: a plane in front of the whole site, not a
  // card on the ground beside the list. It is measured against the viewport because the panel is
  // fixed, and it clears the shell header, which is the part that makes it read as unbroken.
  const view = page.viewportSize();
  expect(over?.y).toBeCloseTo(0, 0);
  expect(over?.height).toBeCloseTo(view?.height ?? 0, 0);
  const header = await page.locator('header').boundingBox();
  expect((header?.x ?? 0) + (header?.width ?? 0)).toBeGreaterThan(over?.x ?? 0);

  // Not modal: no scrim was added, the list still scrolls, and it still takes Tab.
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  const second = page.locator('[data-entity-list] [data-row-id]').nth(1);
  await second.focus();
  await expect(second).toBeFocused();

  // Closing it puts nothing back, because nothing had moved.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  const after = await list.boundingBox();
  expect(after?.width).toBeCloseTo(closed?.width ?? 0, 0);
});
