// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import type { ReactNode } from 'react';
import { EntityFacets } from '../EntityFacets';
import { testConfig, testController } from './fixtures';
// EP-B42: a facet may be one calendar day. It is drawn with the product's date picker under its
// own label and sits among the choice facets, under its own URL key, the way they do.
const facets = [
  { key: 'category', label: 'Category', options: [{ value: '', label: 'Any' }] },
  { key: 'due', kind: 'date' as const, label: 'Due on' },
];
function mount(node: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ dateTime: { day: { day: 'numeric', month: 'short', year: 'numeric' } } }}
    >
      {node}
    </NextIntlClientProvider>,
  );
}
describe('date facet', () => {
  afterEach(cleanup);
  it('EP-B42 a date facet is a date picker under its label, beside the choice facets', () => {
    const navigate = vi.fn();
    const config = testConfig({ filters: { views: [], facets } });
    const controller = testController({ facets: { category: '', due: '' }, navigate });
    mount(<EntityFacets config={config} controller={controller} />);
    // The choice facet is still a select; the day is a picker that says no day is chosen.
    expect(screen.getByLabelText('Category')).toBeTruthy();
    const picker = screen.getByRole('button', { name: 'Due on' });
    expect(picker.textContent).toContain(en.common.noDate);
  });
  it('EP-B42 a chosen day is read back from the facet key and shown on the picker', () => {
    const config = testConfig({ filters: { views: [], facets } });
    const controller = testController({ facets: { category: '', due: '2026-09-16' } });
    mount(<EntityFacets config={config} controller={controller} />);
    const picker = screen.getByRole('button', { name: 'Due on' });
    expect(picker.textContent).toContain('2026');
    expect(picker.textContent).not.toContain(en.common.noDate);
  });
});
