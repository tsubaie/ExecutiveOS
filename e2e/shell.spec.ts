import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };

// ADMIN-B19: the phone bar carries four destinations and a door to the rest. It used to draw
// every entry — seven 44 px slots at zero gap with labels running to 84 px — so the names
// overlapped their neighbours at every width a phone offers and the last one left the screen.
// The measurement is of the labels, not of the markup: the old bar rendered seven perfectly valid
// links and was still unusable.
for (const locale of ['en', 'ar'] as const) {
  for (const width of [320, 390]) {
    test(`ADMIN-B19 the bottom bar's labels fit their slots at ${width} px (${locale})`, async ({
      page,
    }) => {
      const m = locale === 'ar' ? ar : en;
      await loginAs(page, locale);
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/home');
      const bar = page.locator('.mobile-navigation');
      await expect(bar).toBeVisible();

      const slots = await bar.evaluate((nav) =>
        [...nav.children].map((slot) => {
          const label = slot.querySelector('span');
          const box = slot.getBoundingClientRect();
          return {
            text: label?.textContent?.trim() ?? '',
            left: box.left,
            right: box.right,
            // A label wider than the slot draws over whatever is beside it.
            overflows: label ? label.scrollWidth > Math.ceil(label.getBoundingClientRect().width) + 1 : false,
          };
        }),
      );

      expect(slots.length).toBe(5);
      expect(slots.filter((slot) => slot.overflows).map((slot) => slot.text)).toEqual([]);
      // No slot may start before its predecessor ends.
      const ordered = [...slots].sort((a, b) => a.left - b.left);
      for (let i = 1; i < ordered.length; i++)
        expect(ordered[i]!.left).toBeGreaterThanOrEqual(ordered[i - 1]!.right - 1);
      // And the whole bar stays on screen, in either direction.
      for (const slot of slots) {
        expect(slot.right).toBeLessThanOrEqual(width + 1);
        expect(slot.left).toBeGreaterThanOrEqual(-1);
      }

      // Nothing is lost: what the bar no longer names is behind the door, administration included.
      await page.getByRole('button', { name: m.common.navMore, exact: true }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('link', { name: m.common.admin, exact: true })).toBeVisible();
      await sheet.getByRole('link', { name: m.common.admin, exact: true }).click();
      await expect(page).toHaveURL(/admin/);
    });
  }
}
