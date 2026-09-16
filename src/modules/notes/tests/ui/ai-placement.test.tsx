// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import { TagsEditor } from '../../ui/TagsEditor';
vi.mock('../../ui/queries', () => ({ useTags: () => ({ data: undefined }) }));
afterEach(cleanup);
const wrap = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  );
const action = <button type="button">{en.ai.refine}</button>;
it('NOTES-B22 the content field carries its own AI action on its label row', () => {
  wrap(<MarkdownField label={en.notes.content} value="Priorities for the week." action={action} />);
  const label = screen.getByText(en.notes.content);
  const button = screen.getByRole('button', { name: en.ai.refine });
  // Same row as the label it belongs to, not a band above the record.
  expect(label.parentElement).toBe(button.parentElement);
});
it('NOTES-B22 the tags field carries its own AI action on its label row', () => {
  wrap(<TagsEditor tags={[]} save={vi.fn()} action={action} />);
  const label = screen.getByText(en.notes.tags);
  const button = screen.getByRole('button', { name: en.ai.refine });
  expect(label.parentElement).toBe(button.parentElement);
});
it('NOTES-B22 a field with no AI action renders no empty slot beside its label', () => {
  wrap(<MarkdownField label={en.notes.content} value="Priorities for the week." />);
  expect(screen.queryByRole('button', { name: en.ai.refine })).toBeNull();
  expect(screen.getByText(en.notes.content)).toBeTruthy();
});
