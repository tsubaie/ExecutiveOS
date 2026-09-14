import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

// EP-B23: opening a record has to make that record the subject of the page. Every part of this is
// CSS, and the part that kept failing was a cascade problem rather than a missing rule, so the
// assertions read computed style from a real browser rather than class names from a render.
test.describe('entity detail focus @desktop', () => {
  test('EP-B23 the page hands the open record the foreground', async ({ page }) => {
    await loginAs(page, 'en');
    await page.goto('/tasks');
    const row = page.locator('[data-entity-list] .entity-row').first();
    await row.click();
    await page.waitForSelector('.entity-detail');

    // The click that opens a record leaves the pointer on the list, so the hover escape would
    // cancel the softening at the only moment it matters. The hold has to outrank it.
    const held = await page.evaluate(() => {
      const list = document.querySelector('[data-entity-list]');
      if (!list) return null;
      return {
        holding: list.getAnimations().some((a) => 'animationName' in a && a.animationName === 'hold-dim'),
        filter: getComputedStyle(list).filter,
      };
    });
    expect(held?.holding).toBe(true);
    expect(held?.filter).toContain('blur(');

    // One raised plane: the panel keeps the surface tone, the list drops to the page ground.
    const planes = await page.evaluate(() => {
      const style = (s: string) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el) : null;
      };
      const list = style('[data-entity-list]');
      const panel = style('.entity-detail');
      const current = style('.entity-row[data-current]');
      return {
        ground: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        listBg: list?.backgroundColor ?? null,
        panelBg: panel?.backgroundColor ?? null,
        panelShadow: panel?.boxShadow ?? null,
        currentBg: current?.backgroundColor ?? null,
        listWidth: document.querySelector('[data-entity-list]')?.getBoundingClientRect().width ?? 0,
        panelWidth: document.querySelector('.entity-detail')?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(planes.listBg).not.toBe(planes.panelBg);
    expect(planes.panelShadow).not.toBe('none');
    // The record is the subject, so it carries the wider column.
    expect(planes.panelWidth).toBeGreaterThan(planes.listWidth);
    // The selected row keeps its place with the edge bar alone; the tinted ground goes.
    expect(planes.currentBg).toBe('rgba(0, 0, 0, 0)');

    // The heading is focused so the record is announced, but it is not tabbable and draws no ring.
    const heading = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        tag: active?.tagName ?? null,
        tabIndex: active?.getAttribute('tabindex') ?? null,
        outline: active ? getComputedStyle(active).outlineStyle : null,
      };
    });
    expect(heading.tag).toBe('H2');
    expect(heading.tabIndex).toBe('-1');
    expect(heading.outline).toBe('none');
  });
});
