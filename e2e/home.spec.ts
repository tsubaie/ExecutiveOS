import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };

// HOME-B13: a grid item does not shrink below its own min-content, and a committee named after a
// UUID has no break in it, so the column grew past its track and carried every section's "View
// all" off the end of the screen. The `lg` template already said `minmax(0, …)`; the implicit
// single column of a phone needed saying too.
//
// The assertion is on the columns and on the one control the overflow takes away. Sweeping the
// whole subtree for boxes past the edge does not work here: the shell root is `overflow-hidden`,
// so every overflowing box has a clipping ancestor and a filter written that way passes whatever
// the page does.
for (const locale of ['en', 'ar'] as const) {
  test(`HOME-B13 no section runs past the end of a phone screen (${locale})`, async ({ page }) => {
    const m = locale === 'ar' ? ar : en;
    await loginAs(page, locale);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');
    const columns = page.locator('.home-column');
    await expect(columns.first()).toBeVisible();
    const boxes = await columns.evaluateAll((nodes) =>
      nodes.map((node) => ({
        left: Math.round(node.getBoundingClientRect().left),
        right: Math.round(node.getBoundingClientRect().right),
        limit: window.innerWidth,
      })),
    );
    expect(boxes.length).toBeGreaterThan(0);
    // RTL overflows towards zero rather than past the far edge, so both sides are checked.
    for (const column of boxes) {
      expect(column.right).toBeLessThanOrEqual(column.limit);
      expect(column.left).toBeGreaterThanOrEqual(-1);
    }

    // Every section's way into the module has to be reachable, which is what the overflow removed.
    // The axis under test is the horizontal one: a link further down the page is off screen
    // because the page scrolls, which is not the defect.
    const links = page.getByRole('link', { name: m.home.viewAll, exact: true });
    expect(await links.count()).toBeGreaterThan(0);
    const past = await links.evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return box.right > window.innerWidth + 1 || box.left < -1;
        })
        .map((node) => Math.round(node.getBoundingClientRect().right)),
    );
    expect(past).toEqual([]);
  });
}
