// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { pressedAway, usePointerAway } from '../use-pointer-away';
function surface() {
  const root = document.createElement('section');
  root.innerHTML =
    '<div data-entity-list><h2 class="group">Today</h2><div data-row-id="a"><span>Row</span></div></div>' +
    '<aside class="entity-detail"><h2>Record</h2><input /></aside>';
  document.body.append(root);
  const outside = document.createElement('div');
  outside.innerHTML =
    '<header><div class="ground"></div><button class="shell">Search</button></header>' +
    '<div data-base-ui-portal=""><div role="listbox"><div role="option">Pick</div></div></div>' +
    '<div role="status"><button class="undo">Undo</button></div>';
  document.body.append(outside);
  return { root, outside };
}
const wide = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});
describe('pointer away', () => {
  it('EP-B43 a press on the ground anywhere behind the slide-over counts; the panel, a row, a control, a portal, a toast and a phone do not', () => {
    const { root, outside } = surface();
    const pick = (selector: string, from: ParentNode = root) => from.querySelector(selector);
    wide(true);
    expect(pressedAway(root, pick('.group'))).toBe(true);
    expect(pressedAway(root, pick('[data-entity-list]'))).toBe(true);
    expect(pressedAway(root, pick('[data-row-id] span'))).toBe(false);
    expect(pressedAway(root, pick('aside input'))).toBe(false);
    expect(pressedAway(root, pick('.ground', outside))).toBe(true);
    expect(pressedAway(root, document.body)).toBe(true);
    // A control does only what it does: the view button ends the record through its own navigation.
    expect(pressedAway(root, pick('.shell', outside))).toBe(false);
    expect(pressedAway(root, pick('[role=option]', outside))).toBe(false);
    expect(pressedAway(root, pick('.undo', outside))).toBe(false);
    expect(pressedAway(null, pick('.group'))).toBe(false);
    wide(false);
    expect(pressedAway(root, pick('.group'))).toBe(false);
  });
  it('EP-B43 while a record is open, a press on the plane behind it closes it through the same close as Esc', () => {
    const { root } = surface();
    wide(true);
    const close = vi.fn();
    const hook = renderHook(({ panel }) => usePointerAway({ current: root }, { panel, close }), {
      initialProps: { panel: true },
    });
    const press = (target: Element | null) =>
      target?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    press(root.querySelector('.group'));
    expect(close).toHaveBeenCalledTimes(1);
    press(root.querySelector('aside input'));
    press(root.querySelector('[data-row-id] span'));
    expect(close).toHaveBeenCalledTimes(1);
    hook.rerender({ panel: false });
    press(root.querySelector('.group'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
