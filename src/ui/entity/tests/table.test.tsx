// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { EntityTable } from '../EntityTable';
import { useEntityLayout } from '../use-layout';
import { clearEntityFilters } from '../url-state';
import type { Column } from '../types';
import { testConfig, testController, testRow, type TestRow } from './fixtures';
const rows = [testRow('a', 'Alpha', 12), testRow('b', 'Beta', 34)];
const columns: Column<TestRow>[] = [
  { key: 'name', head: 'Name', primary: true, sort: 'name', cell: (row) => row.name },
  { key: 'score', head: 'Score', numeric: true, cell: (row) => row.score },
];
function renderTable(group?: (row: TestRow) => string) {
  const config = testConfig({
    ...(group ? { group } : {}),
    renderers: { ...testConfig().renderers, columns },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EntityTable
        config={config}
        controller={testController({
          state: {
            creating: false,
            id: null,
            view: 'all',
            q: '',
            sort: '',
            layout: 'table',
            focus: '',
          },
        })}
        rows={rows.map((item) => ({ item, leaving: false, entering: false }))}
      />
    </NextIntlClientProvider>,
  );
}
describe('entity table', () => {
  afterEach(cleanup);
  it('EP-B29 the table is a real table: a caption, column headers, and one row header per record', () => {
    renderTable();
    expect(screen.getByRole('table', { name: 'Measures' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Name',
      'Score',
    ]);
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });
  it('EP-B29 exactly one control per row opens the record, and it lives in the row header', () => {
    renderTable();
    // One per record, in the body. A sortable column header is a control of the table, not of a row.
    const openers = screen.getAllByRole('rowheader').map((cell) => cell.querySelector('button'));
    expect(openers.filter(Boolean)).toHaveLength(rows.length);
    const opener = screen.getByRole('button', { name: 'Alpha' });
    expect(opener.closest('th')?.getAttribute('scope')).toBe('row');
    // The hit area is the row's, and it comes from the one control rather than from nested ones.
    expect(opener.className).toContain('entity-table-open');
  });
  it('EP-B29 a numeric column takes tabular figures and the end edge', () => {
    renderTable();
    const cell = screen.getByText('12').closest('td');
    expect(cell?.className).toContain('tabular-nums');
    expect(cell?.className).toContain('text-end');
  });
  it('EP-B14 EP-B29 a group heading is a row spanning every column', () => {
    renderTable((row) => (row.name === 'Alpha' ? 'First' : 'Second'));
    const heading = screen.getByText('First').closest('th');
    expect(heading?.getAttribute('scope')).toBe('colgroup');
    expect(heading?.getAttribute('colspan')).toBe(String(columns.length));
  });
});
describe('entity column sorting', () => {
  afterEach(cleanup);
  function renderWith(sort: string) {
    const config = testConfig({ renderers: { ...testConfig().renderers, columns } });
    const controller = testController({
      state: { creating: false, id: null, view: 'all', q: '', sort, layout: 'table', focus: '' },
    });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <EntityTable
          config={config}
          controller={controller}
          rows={rows.map((item) => ({ item, leaving: false, entering: false }))}
        />
      </NextIntlClientProvider>,
    );
    return controller;
  }
  it('EP-B31 a column that names a sort orders by it; one that does not offers no control', () => {
    renderWith('');
    expect(screen.getByRole('columnheader', { name: 'Name' }).getAttribute('aria-sort')).toBe(
      'none',
    );
    expect(screen.getByRole('button', { name: 'Name' })).toBeTruthy();
    // The unsorted column is text, not a control that would promise an order it cannot deliver.
    expect(screen.queryByRole('button', { name: 'Score' })).toBeNull();
    expect(
      screen.getByRole('columnheader', { name: 'Score' }).getAttribute('aria-sort'),
    ).toBeNull();
  });
  it('EP-B31 pressing the column already ordering the list returns to the default', () => {
    const idle = renderWith('');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(idle.navigate).toHaveBeenCalledWith({ sort: 'name' }, true);
    cleanup();
    const active = renderWith('name');
    // Active reports its state, and the same press is the undo.
    expect(screen.getByRole('columnheader', { name: 'Name' }).getAttribute('aria-sort')).toBe(
      'other',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(active.navigate).toHaveBeenCalledWith({ sort: null }, true);
  });
});
describe('entity layout', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });
  it('EP-B29 the URL wins while it says anything, and storage answers when it does not', () => {
    window.localStorage.setItem('eos.layout.tasks', 'table');
    const stored = renderHook(() => useEntityLayout('tasks', '', true, vi.fn()));
    expect(stored.result.current.layout).toBe('table');
    const fromUrl = renderHook(() => useEntityLayout('tasks', '', true, vi.fn()));
    expect(fromUrl.result.current.layout).toBe('table');
    // A URL that names a layout is the truth, even against a different remembered one.
    const linked = renderHook(() => useEntityLayout('tasks', 'cards', true, vi.fn()));
    expect(linked.result.current.layout).toBe('cards');
  });
  it('EP-B29 choosing a layout remembers it and writes the URL; no columns means no choice', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useEntityLayout('notes', '', true, navigate));
    act(() => result.current.setLayout('table'));
    expect(window.localStorage.getItem('eos.layout.notes')).toBe('table');
    expect(navigate).toHaveBeenCalledWith({ layout: 'table' }, true);
    // A module that declares no columns is never put into a layout it cannot render.
    const none = renderHook(() => useEntityLayout('notes', 'table', false, navigate));
    expect(none.result.current.layout).toBe('');
  });
  it('EP-B29 clearing the filters does not take away the chosen layout', () => {
    expect(Object.keys(clearEntityFilters(['category']))).not.toContain('layout');
  });
});
