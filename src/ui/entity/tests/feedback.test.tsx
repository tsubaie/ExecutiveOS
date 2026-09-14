// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SaveStatus } from '@/ui/layout/SaveStatus';
import { EntityBulkBar } from '../EntityBulkBar';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/ui/format', () => ({ useCount: () => (value: number) => String(value) }));
afterEach(cleanup);
// EP-B24: a change the user caused has to say so. These are the hooks the stylesheet animates; the
// assertion is that the right element carries the right one in the right state, because the common
// failure is a control that changes silently, not an animation that plays wrongly.
it('EP-B24 the save tick lands as an event and only once the save has landed', () => {
  const view = render(<SaveStatus state="saving" />);
  expect(document.querySelector('.save-tick')).toBeNull();
  view.rerender(<SaveStatus state="saved" />);
  expect(document.querySelector('.save-tick')).not.toBeNull();
  view.rerender(<SaveStatus state="error" />);
  expect(document.querySelector('.save-tick')).toBeNull();
});
it('EP-B24 the bulk bar arrives rather than appearing in place', () => {
  render(<EntityBulkBar items={[]} actions={[]} clear={() => {}} />);
  expect(screen.getByText('selectedCount').closest('[data-entity-bulk]')?.className).toContain(
    'rise-in',
  );
});
