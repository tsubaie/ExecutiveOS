// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import { TagsEditor } from '../../ui/TagsEditor';
import { mount } from './harness';
const input = () => screen.getByLabelText(en.notes.addTagLabel);
const options = () => screen.queryAllByRole('option').map((option) => option.textContent);
const refetchTags = vi.hoisted(() => vi.fn());
vi.mock('../../ui/queries', () => ({
  useTags: () => ({
    data: {
      data: [
        { tag: 'budget', count: 1 },
        { tag: 'Risk', count: 2 },
        { tag: 'Removed', count: 0 },
      ],
    },
    refetch: refetchTags,
  }),
}));
describe('tags editor', () => {
  it('NOTES-B13 lists only used unselected tags on focus and refreshes without browser history', () => {
    mount(<TagsEditor tags={['Budget']} save={vi.fn()} />);
    expect(input().getAttribute('autocomplete')).toBe('off');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(input());
    expect(refetchTags).toHaveBeenCalled();
    expect(options()).toEqual(['Risk']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });
  it('NOTES-B13 filters as typed, offers a new name, and adds a picked row with no Enter', () => {
    const save = vi.fn();
    mount(<TagsEditor tags={[]} save={save} />);
    fireEvent.change(input(), { target: { value: 'ri' } });
    expect(options()).toEqual(['Risk', 'Add "ri"']);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(input().getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[1]?.id,
    );
    fireEvent.mouseDown(screen.getAllByRole('option')[0] as Element);
    expect(save).toHaveBeenLastCalledWith(['Risk']);
    expect((input() as HTMLInputElement).value).toBe('');
  });
  it('NOTES-I03 adds on Enter, ignores a duplicate spelling, and removes through the chip', () => {
    const save = vi.fn();
    mount(<TagsEditor tags={['Budget']} save={save} />);
    fireEvent.change(input(), { target: { value: 'Risk' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(save).toHaveBeenLastCalledWith(['Budget', 'Risk']);
    fireEvent.change(input(), { target: { value: 'budget' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Budget' }));
    expect(save).toHaveBeenLastCalledWith([]);
  });
  it('NOTES-I03 blocks the eleventh tag with a count instead of saving', () => {
    const save = vi.fn();
    const tags = Array.from({ length: 10 }, (_, i) => `t${i}`);
    mount(<TagsEditor tags={tags} save={save} />);
    expect(screen.getByText('10 of 10 tags')).toBeTruthy();
    fireEvent.change(input(), { target: { value: 'eleven' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('10 of 10 tags');
  });
});
