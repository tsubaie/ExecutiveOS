// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PanelPosition } from '../EntityPanel';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    values ? `${key}=${values.position}/${values.count}` : key,
}));
afterEach(cleanup);
it('EP-B07 the position moves the reader through the loaded list', () => {
  const move = vi.fn();
  render(
    <PanelPosition neighbors={{ previous: true, next: true, position: 3, count: 11 }} move={move} />,
  );
  expect(screen.getByText('position=3/11')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'previous' }));
  fireEvent.click(screen.getByRole('button', { name: 'next' }));
  expect(move.mock.calls).toEqual([[-1], [1]]);
});
it('EP-B07 the ends of the list disable the direction that would leave it', () => {
  render(
    <PanelPosition neighbors={{ previous: false, next: true, position: 1, count: 4 }} move={vi.fn()} />,
  );
  expect(screen.getByRole('button', { name: 'previous' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: 'next' })).toHaveProperty('disabled', false);
});
it('EP-B07 a record with no place in the loaded list shows no position at all', () => {
  const { container } = render(
    <PanelPosition neighbors={{ previous: false, next: false, position: 0, count: 0 }} move={vi.fn()} />,
  );
  expect(container.firstChild).toBeNull();
});
