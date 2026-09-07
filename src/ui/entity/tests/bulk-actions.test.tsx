// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { EntityBulkBar } from '../EntityBulkBar';
import type { BulkAction, Entity } from '../types';
const doneLabel = 'done';
const items: Entity[] = [
  { id: 'a', revision: 1, deletedAt: null, deletedOpId: null },
  { id: 'b', revision: 1, deletedAt: null, deletedOpId: null },
];
function mount(actions: BulkAction<Entity>[], clear = vi.fn()) {
  cleanup();
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
    >
      <EntityBulkBar items={items} actions={actions} clear={clear} />
    </NextIntlClientProvider>,
  );
  return clear;
}
describe('entity bulk bar', () => {
  it('EP-B06 a confirmed action runs once and clears the selection', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const clear = mount([
      { id: 'archive', label: 'Archive', confirm: { title: 'Archive?', description: 'Sure' }, run },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(await screen.findByRole('button', { name: en.common.confirm }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(items));
    expect(run).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });
  it('EP-B06 the render escape hatch receives the items and finish(true) clears the selection', async () => {
    const seen: string[][] = [];
    const clear = mount([
      {
        id: 'group',
        label: 'Group',
        enabled: (selected) => selected.length >= 2,
        render: (selected, finish) => {
          seen.push(selected.map((item) => item.id));
          return (
            <button type="button" onClick={() => finish(true)}>
              {doneLabel}
            </button>
          );
        },
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Group' }));
    fireEvent.click(await screen.findByRole('button', { name: doneLabel }));
    expect(seen[0]).toEqual(['a', 'b']);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: doneLabel })).toBeNull();
  });
  it('EP-B06 disabled predicates keep an action inert and the count is announced', () => {
    mount([{ id: 'x', label: 'Needs three', enabled: (selected) => selected.length >= 3 }]);
    expect(screen.getByRole('button', { name: 'Needs three' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });
});
