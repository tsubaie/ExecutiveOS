// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import { Markdown } from '@/ui/markdown/Markdown';
import {
  derivedParticipants,
  insertMention,
  matchMentions,
  mentionAt,
} from '@/ui/markdown/mentions';
import { mount } from './harness';
const content = [
  '# Agenda',
  '',
  '<script>alert(1)</script>',
  '',
  '![leak](https://example.test/pixel.png)',
  '',
  '[site](https://example.test) and [bad](javascript:alert(1))',
  '',
  'نقاط النقاش الرئيسية',
  '',
  '- [ ] item',
].join('\n');
const people = [
  { id: 'a', name: 'Leila Haddad' },
  { id: 'b', name: 'Omar Nasser' },
  { id: 'c', name: 'سامر منصور' },
];
describe('markdown field', () => {
  it('NOTES-A09 shows the sanitized preview of saved content: headings and lists render, scripts, images and unsafe links are stripped, Arabic lays out by paragraph', async () => {
    mount(<MarkdownField label="Content" value={content} />);
    const heading = await screen.findByRole('heading', { name: 'Agenda' });
    expect(heading.getAttribute('dir')).toBe('auto');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).not.toContain('alert(1)');
    // Inside the editable preview links are text; the standalone renderer keeps safe hrefs only.
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByText('site')).toBeTruthy();
    expect(screen.getByText('نقاط النقاش الرئيسية').getAttribute('dir')).toBe('auto');
    expect(document.querySelector('li input[type="checkbox"]')).not.toBeNull();
    mount(<Markdown content={content} />);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links.filter(Boolean)).toEqual(['https://example.test']);
    expect(links.some((href) => href?.startsWith('javascript'))).toBe(false);
    expect(document.querySelector('a')?.getAttribute('rel')).toContain('noopener');
  });
  it('NOTES-B07 entering the preview opens the textarea; leaving commits once and shows the preview again', async () => {
    const commit = vi.fn();
    mount(<MarkdownField label="Content" value="before" onCommit={commit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Content' }));
    const box = await screen.findByRole('textbox', { name: 'Content' });
    fireEvent.change(box, { target: { value: 'after' } });
    fireEvent.blur(box);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('after');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Content' })).toBeTruthy());
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('NOTES-B07 empty content starts as a textarea and stays one after leaving', async () => {
    mount(<MarkdownField label="Content" value="" />);
    const box = await screen.findByRole('textbox', { name: 'Content' });
    fireEvent.blur(box);
    expect(screen.getByRole('textbox', { name: 'Content' })).toBeTruthy();
  });
  it('NOTES-B08 typing "@" lists people, Enter inserts the name and reports the pick', async () => {
    const onPick = vi.fn();
    mount(<MarkdownField label="Content" value="" mentions={{ items: people, onPick }} />);
    const area = (await screen.findByRole('textbox', { name: 'Content' })) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Met @le' } });
    area.setSelectionRange(7, 7);
    fireEvent.keyUp(area, { key: 'e' });
    expect(screen.getByRole('option', { name: 'Leila Haddad' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Omar Nasser' })).toBeNull();
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(people[0]);
    expect((screen.getByRole('textbox', { name: 'Content' }) as HTMLTextAreaElement).value).toBe(
      'Met @Leila Haddad ',
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    // Typing on after the pick is prose, not a new search.
    fireEvent.change(area, { target: { value: 'Met @Leila Haddad about' } });
    fireEvent.keyUp(area, { key: 't' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(area, { target: { value: 'Met @Leila Haddad about @' } });
    fireEvent.keyUp(area, { key: '@' });
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
  it('NOTES-B08 a multi-word unknown name still offers "Add" when creation is allowed', async () => {
    const onPick = vi.fn();
    mount(
      <MarkdownField
        label="Content"
        value=""
        mentions={{ items: people, onPick, allowCreate: true }}
      />,
    );
    const area = (await screen.findByRole('textbox', { name: 'Content' })) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'with @Nadia Q' } });
    fireEvent.keyUp(area, { key: 'Q' });
    const option = screen.getByRole('option', { name: 'Add “Nadia Q”' });
    fireEvent.mouseDown(option);
    expect(onPick).toHaveBeenCalledWith({ id: 'new:Nadia Q', name: 'Nadia Q', create: true });
    expect(area.value).toBe('with @Nadia Q ');
  });
  it('NOTES-B08 arrow keys move through the whole list and wrap', async () => {
    mount(<MarkdownField label="Content" value="" mentions={{ items: people, onPick: vi.fn() }} />);
    const area = (await screen.findByRole('textbox', { name: 'Content' })) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: '@' } });
    fireEvent.keyUp(area, { key: '@' });
    const selected = () =>
      screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected()).toBe(0);
    fireEvent.keyDown(area, { key: 'ArrowDown' });
    fireEvent.keyUp(area, { key: 'ArrowDown' });
    expect(selected()).toBe(1);
    fireEvent.keyDown(area, { key: 'ArrowDown' });
    fireEvent.keyUp(area, { key: 'ArrowDown' });
    expect(selected()).toBe(2);
    fireEvent.keyDown(area, { key: 'ArrowDown' });
    fireEvent.keyUp(area, { key: 'ArrowDown' });
    expect(selected()).toBe(0);
    fireEvent.keyDown(area, { key: 'ArrowUp' });
    fireEvent.keyUp(area, { key: 'ArrowUp' });
    expect(selected()).toBe(2);
  });
});
describe('mention helpers', () => {
  it('NOTES-B08 finds the token at the caret, filters by name and inserts in place', () => {
    expect(mentionAt('hello @om', 9)).toEqual({ start: 6, query: 'om' });
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionAt('mail@example', 12)).toBeNull();
    expect(mentionAt('hello @om\n', 10)).toBeNull();
    expect(matchMentions(people, 'سامر').map((p) => p.id)).toEqual(['c']);
    expect(matchMentions(people, '').map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(insertMention('hello @om there', { start: 6, query: 'om' }, 9, 'Omar Nasser')).toEqual({
      text: 'hello @Omar Nasser  there',
      caret: 19,
    });
  });
  it('NOTES-B08 offers to add an unknown name and derives participants from the content', () => {
    expect(matchMentions(people, 'Nadia', true).map((p) => p.id)).toEqual(['new:Nadia']);
    expect(matchMentions(people, 'Leila Haddad', true).map((p) => p.id)).toEqual(['a']);
    expect(matchMentions(people, '', true).map((p) => p.create ?? false)).toEqual([
      false,
      false,
      false,
    ]);
    expect(derivedParticipants('Met @Omar Nasser and @سامر منصور today', people)).toEqual([
      'b',
      'c',
    ]);
    expect(derivedParticipants('nobody here', people)).toEqual([]);
  });
});
