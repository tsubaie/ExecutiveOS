// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEntityKeyboard } from '../use-entity-keyboard';
import type { Entity } from '../types';
function setup(overrides: Partial<Parameters<typeof useEntityKeyboard>[1]> = {}) {
  const root = document.createElement('section');
  const input = document.createElement('input');
  root.append(input);
  document.body.append(root);
  const options = {
    items: [{ id: 'a', revision: 1, deletedAt: null, deletedOpId: null }] as Entity[],
    focused: 0,
    setFocused: vi.fn(),
    navigate: vi.fn(),
    close: vi.fn(),
    panel: false,
    selected: ['a'],
    selectable: true,
    select: vi.fn(),
    clear: vi.fn(),
    openBulk: vi.fn(),
    ...overrides,
  };
  renderHook(() => useEntityKeyboard({ current: root }, options));
  return { root, input, options };
}
describe('entity keyboard', () => {
  it('EP-B06 a with a selection opens the bulk actions and x toggles the focused row', () => {
    const { root, options } = setup();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(options.openBulk).toHaveBeenCalledTimes(1);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(options.select).toHaveBeenCalledTimes(1);
    expect(options.navigate).toHaveBeenCalledWith({ sel: '' }, true);
  });
  it('EP-B06 shortcuts are ignored while an input has focus and Escape clears the list state', () => {
    const { root, input, options } = setup();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(options.openBulk).not.toHaveBeenCalled();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(options.clear).toHaveBeenCalledTimes(1);
    expect(options.close).not.toHaveBeenCalled();
  });
});
