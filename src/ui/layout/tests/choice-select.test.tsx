// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ChoiceSelect, SEARCH_THRESHOLD } from '../ChoiceSelect';
// Hold the lazy searchable picker at its fallback to exercise submission before it loads.
vi.mock('../SearchableChoice', () => new Promise(() => undefined));
afterEach(cleanup);
it('COMM-A01 preserves the selected form value while the searchable picker loads', () => {
  const items = Array.from({ length: SEARCH_THRESHOLD + 1 }, (_, index) => ({ value: String(index), text: `Choice ${index}`, label: `Choice ${index}` }));
  const { container } = render(<form><ChoiceSelect name="committeeId" label="Committee" items={items} value="3" onChange={() => undefined} /></form>);
  const form = container.querySelector('form');
  if (!form) throw new Error('Missing form');
  expect(new FormData(form).getAll('committeeId')).toEqual(['3']);
});
it('COMM-A01 submits exactly one selected value for a plain picker', () => {
  const { container } = render(<form><ChoiceSelect name="scope" label="Scope" items={[{ value: 'internal', text: 'Internal', label: 'Internal' }]} value="internal" onChange={() => undefined} /></form>);
  const form = container.querySelector('form');
  if (!form) throw new Error('Missing form');
  expect(new FormData(form).getAll('scope')).toEqual(['internal']);
});
