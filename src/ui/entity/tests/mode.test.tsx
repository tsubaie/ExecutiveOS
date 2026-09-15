// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import type { ReactNode } from 'react';
import { EntityModes } from '../EntityModes';
import { EntityFacets } from '../EntityControls';
import { testConfig, testController, type TestRow } from './fixtures';
// EP-B28: a mode is not a filter. It removes nothing from the list, it changes what every row of
// it says, so it sits in the toolbar in its own right and never among the filter selects.
const mode = {
  key: 'period',
  label: 'Measured against',
  options: [
    { id: 'previous', label: 'Previous' },
    { id: '', label: 'Current' },
    { id: 'next', label: 'Next' },
  ],
};
const facets = [{ key: 'category', label: 'Category', options: [{ value: '', label: 'Any' }] }];
const columns = [{ key: 'name', head: 'Name', primary: true, cell: (row: TestRow) => row.name }];
function surface(withColumns = true) {
  const navigate = vi.fn();
  const base = testConfig();
  const config = testConfig({
    filters: { views: [], facets, mode },
    renderers: withColumns ? { ...base.renderers, columns } : base.renderers,
  });
  const controller = testController({ facets: { period: '' }, navigate });
  return { config, controller, navigate };
}
function mount(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  );
}
describe('entity mode', () => {
  afterEach(cleanup);
  it('EP-B28 the mode is a segmented group in the toolbar, with the current option pressed', () => {
    const { config, controller } = surface();
    mount(<EntityModes config={config} controller={controller} />);
    const group = screen.getByRole('group', { name: mode.label });
    expect(group).toBeTruthy();
    const current = screen.getByRole('button', { name: 'Current' });
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Previous' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
  it('EP-B28 choosing a reading navigates under the mode key and closes any open record', () => {
    const { config, controller, navigate } = surface();
    mount(<EntityModes config={config} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(navigate).toHaveBeenCalledWith({ period: 'next', id: null, sel: null }, true);
  });
  it('EP-B28 the mode is never rendered among the filters', () => {
    const { config, controller } = surface();
    mount(<EntityFacets config={config} controller={controller} />);
    expect(screen.queryByRole('group', { name: mode.label })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
  });
  it('EP-B29 a module with no columns is offered no layout choice', () => {
    const { config, controller } = surface(false);
    mount(<EntityModes config={config} controller={controller} />);
    expect(screen.queryByRole('group', { name: en.common.layout })).toBeNull();
    // The reading control is independent of it and still stands.
    expect(screen.getByRole('group', { name: mode.label })).toBeTruthy();
  });
});
