// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEntityKeyboard } from '../use-entity-keyboard';
import type { Entity } from '../types';
// EP-B27: a grid has two axes. Down is a whole track row away, not the next record, and left and
// right exist at all only because there is more than one column to move between. The track count
// is read from the list's computed columns, so the test states it the way the browser reports it.
function setup(columns: string, direction: 'ltr' | 'rtl' = 'ltr') {
  const root = document.createElement('section');
  const rows = document.createElement('ul');
  rows.setAttribute('data-entity-rows', '');
  root.append(rows);
  document.body.append(root);
  // A real declaration rather than a shaped object: the hook reads these two properties off
  // whatever the browser returns, and an element's own `style` is that same interface.
  const style = document.createElement('div').style;
  style.setProperty('grid-template-columns', columns);
  style.setProperty('direction', direction);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue(style);
  const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({
    id,
    revision: 1,
    deletedAt: null,
    deletedOpId: null,
  })) as Entity[];
  const options = {
    items,
    focused: 3,
    setFocused: vi.fn(),
    navigate: vi.fn(),
    close: vi.fn(),
    panel: false,
    selected: [],
    selectable: false,
    select: vi.fn(),
    clear: vi.fn(),
    openBulk: vi.fn(),
  };
  renderHook(() => useEntityKeyboard({ current: root }, options));
  const press = (key: string) =>
    root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  return { press, options };
}
describe('grid keyboard', () => {
  afterEach(() => vi.restoreAllMocks());
  it('EP-B27 the vertical arrows move a whole track row in a grid', () => {
    const { press, options } = setup('220px 220px 220px');
    press('ArrowUp');
    expect(options.setFocused).toHaveBeenLastCalledWith(0);
    press('ArrowDown');
    // Three columns from index 3 is index 6, which is past the end, so it stops at the last row.
    expect(options.setFocused).toHaveBeenLastCalledWith(5);
  });
  it('EP-B27 the horizontal arrows move one tile, and mirror with the direction', () => {
    const ltr = setup('220px 220px');
    ltr.press('ArrowRight');
    expect(ltr.options.setFocused).toHaveBeenLastCalledWith(4);
    ltr.press('ArrowLeft');
    expect(ltr.options.setFocused).toHaveBeenLastCalledWith(2);
    vi.restoreAllMocks();
    const rtl = setup('220px 220px', 'rtl');
    rtl.press('ArrowLeft');
    expect(rtl.options.setFocused).toHaveBeenLastCalledWith(4);
  });
  it('EP-B27 a list of lines leaves the horizontal arrows to the browser', () => {
    const { press, options } = setup('none');
    press('ArrowLeft');
    press('ArrowRight');
    expect(options.setFocused).not.toHaveBeenCalled();
    // The vertical pair still moves one record at a time.
    press('ArrowDown');
    expect(options.setFocused).toHaveBeenLastCalledWith(4);
  });
});
