// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import { TagsEditor } from '../../ui/TagsEditor';
import { mount } from './harness';
const input = () => screen.getByLabelText(en.notes.addTagLabel);
describe('tags editor', () => {
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
