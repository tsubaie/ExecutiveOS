// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { MarkdownField, COMMIT_EVERY_MS } from '@/ui/markdown/MarkdownField';
import { Markdown } from '@/ui/markdown/Markdown';
import {
  continueList,
  editForKey,
  linkSelection,
  pasteLink,
  shiftList,
  toggleHeading,
  toggleLines,
  wrapSelection,
} from '@/ui/markdown/keys';
import { toggleChecklistItem } from '@/ui/markdown/checklist';
import { mount } from './harness';
afterEach(() => vi.useRealTimers());
async function editor(value = '') {
  mount(<MarkdownField label="Content" value={value} />);
  return (await screen.findByRole('textbox', { name: 'Content' })) as HTMLTextAreaElement;
}
function press(area: HTMLTextAreaElement, key: string, at: number, init: object = {}) {
  area.setSelectionRange(at, at);
  fireEvent.keyDown(area, { key, ...init });
}
describe('editor keys (pure)', () => {
  it('NOTES-B23 Enter continues bullets, numbers and checkboxes, and ends a list on an empty item', () => {
    expect(continueList('- one', 5, 5)).toEqual({ text: '- one\n- ', start: 8, end: 8 });
    expect(continueList('  * one', 7, 7)).toEqual({ text: '  * one\n  * ', start: 12, end: 12 });
    expect(continueList('1. one', 6, 6)).toEqual({ text: '1. one\n2. ', start: 10, end: 10 });
    expect(continueList('9) one', 6, 6)).toEqual({ text: '9) one\n10) ', start: 11, end: 11 });
    expect(continueList('- [x] done', 10, 10)).toEqual({
      text: '- [x] done\n- [ ] ',
      start: 17,
      end: 17,
    });
    // The text after the caret moves to the new item.
    expect(continueList('- one two', 5, 5)).toEqual({ text: '- one\n-  two', start: 8, end: 8 });
    // An item that is only its marker ends the list.
    expect(continueList('- one\n- ', 8, 8)).toEqual({ text: '- one\n', start: 6, end: 6 });
    expect(continueList('- [ ] ', 6, 6)).toEqual({ text: '', start: 0, end: 0 });
    // Not a list line, a caret inside the marker, or a selection: the key keeps its meaning.
    expect(continueList('plain', 5, 5)).toBeNull();
    expect(continueList('- one', 1, 1)).toBeNull();
    expect(continueList('- one', 2, 5)).toBeNull();
  });
  it('NOTES-B23 Tab nests a list line by its marker width and Shift+Tab unnests it', () => {
    expect(shiftList('- one', 5, 5, false)).toEqual({ text: '  - one', start: 7, end: 7 });
    expect(shiftList('1. one', 3, 3, false)).toEqual({ text: '   1. one', start: 6, end: 6 });
    expect(shiftList('  - one', 7, 7, true)).toEqual({ text: '- one', start: 5, end: 5 });
    expect(shiftList('  - one', 1, 1, true)).toEqual({ text: '- one', start: 0, end: 0 });
    expect(shiftList('- one', 5, 5, true)).toEqual({ text: '- one', start: 5, end: 5 });
    // A selection over several lines shifts every list line in it.
    expect(shiftList('- a\n- b\nplain', 0, 13, false)).toEqual({
      text: '  - a\n  - b\nplain',
      start: 0,
      end: 17,
    });
    expect(shiftList('plain', 5, 5, false)).toBeNull();
  });
  it('NOTES-B23 bold and italic wrap the selection or unwrap it, and an empty selection gets a pair', () => {
    expect(wrapSelection('say hi now', 4, 6, '**')).toEqual({
      text: 'say **hi** now',
      start: 6,
      end: 8,
    });
    expect(wrapSelection('say **hi** now', 6, 8, '**')).toEqual({
      text: 'say hi now',
      start: 4,
      end: 6,
    });
    expect(wrapSelection('say **hi** now', 4, 10, '**')).toEqual({
      text: 'say hi now',
      start: 4,
      end: 6,
    });
    expect(wrapSelection('say ', 4, 4, '*')).toEqual({ text: 'say **', start: 5, end: 5 });
  });
  it('NOTES-B23 a link takes selected text as its label or a selected address as its target', () => {
    expect(linkSelection('see docs now', 4, 8)).toEqual({
      text: 'see [docs]() now',
      start: 11,
      end: 11,
    });
    expect(linkSelection('see https://a.test now', 4, 18)).toEqual({
      text: 'see [](https://a.test) now',
      start: 5,
      end: 5,
    });
    expect(linkSelection('', 0, 0)).toEqual({ text: '[]()', start: 3, end: 3 });
    expect(pasteLink('see docs now', 4, 8, ' https://a.test \n')).toEqual({
      text: 'see [docs](https://a.test) now',
      start: 26,
      end: 26,
    });
    expect(pasteLink('see docs now', 4, 4, 'https://a.test')).toBeNull();
    expect(pasteLink('see docs now', 4, 8, 'plain words')).toBeNull();
  });
  it('NOTES-B28 the list toggles mark every selected line, replace other markers, and unmark when all carry the kind', () => {
    expect(toggleLines('one\ntwo', 0, 7, 'bullet')).toEqual({
      text: '- one\n- two',
      start: 0,
      end: 11,
    });
    expect(toggleLines('- one\n- two', 0, 11, 'bullet')).toEqual({
      text: 'one\ntwo',
      start: 0,
      end: 7,
    });
    expect(toggleLines('- one\ntwo', 0, 9, 'bullet').text).toBe('- one\n- two');
    expect(toggleLines('1. one\n- [x] two', 0, 16, 'bullet').text).toBe('- one\n- two');
    expect(toggleLines('one\n\ntwo', 0, 8, 'checklist').text).toBe('- [ ] one\n\n- [ ] two');
    expect(toggleLines('- [ ] one\n- [x] two', 0, 19, 'checklist').text).toBe('one\ntwo');
    expect(toggleLines('- one', 2, 2, 'checklist').text).toBe('- [ ] one');
    expect(toggleLines('  - one', 3, 3, 'checklist').text).toBe('  - [ ] one');
  });
  it('NOTES-B28 the heading toggles set the level on every selected line, replace another level, and unmark when all carry it', () => {
    expect(toggleHeading('Agenda', 0, 6, 2)).toEqual({ text: '## Agenda', start: 0, end: 9 });
    expect(toggleHeading('## Agenda', 3, 3, 2).text).toBe('Agenda');
    expect(toggleHeading('# Agenda', 0, 0, 2).text).toBe('## Agenda');
    expect(toggleHeading('## Agenda', 0, 0, 3).text).toBe('### Agenda');
    expect(toggleHeading('one\ntwo', 0, 7, 3).text).toBe('### one\n### two');
    expect(toggleHeading('### one\ntwo', 0, 11, 3).text).toBe('### one\n### two');
    expect(toggleHeading('', 0, 0, 2).text).toBe('## ');
    // A bidi mark before the marker, which Arabic keyboards insert, is part of the room before it.
    expect(toggleHeading('\u200f# كيف', 0, 0, 2).text).toBe('\u200f## كيف');
    expect(toggleHeading('\u200f## كيف', 0, 0, 2).text).toBe('\u200fكيف');
    // Headings and lists never share a line.
    expect(toggleHeading('- item', 0, 0, 2).text).toBe('## item');
    expect(toggleLines('## Agenda', 0, 0, 'bullet').text).toBe('- Agenda');
    expect(toggleLines('## Agenda', 0, 0, 'checklist').text).toBe('- [ ] Agenda');
  });
  it('NOTES-B23 keys dispatch: modifier letters format, Enter continues, Tab shifts, the rest pass', () => {
    const key = (k: string, mod = false, shift = false) => ({ key: k, mod, shift });
    expect(editForKey('hi', 0, 2, key('B', true))?.text).toBe('**hi**');
    expect(editForKey('hi', 0, 2, key('i', true))?.text).toBe('*hi*');
    expect(editForKey('hi', 0, 2, key('k', true))?.text).toBe('[hi]()');
    expect(editForKey('hi', 0, 2, key('z', true))).toBeNull();
    expect(editForKey('- hi', 4, 4, key('Enter'))?.text).toBe('- hi\n- ');
    expect(editForKey('- hi', 4, 4, key('Enter', false, true))).toBeNull();
    expect(editForKey('- hi', 4, 4, key('Tab'))?.text).toBe('  - hi');
    expect(editForKey('  - hi', 6, 6, key('Tab', false, true))?.text).toBe('- hi');
    expect(editForKey('hi', 2, 2, key('a'))).toBeNull();
  });
});
describe('editor keys (textarea)', () => {
  it('NOTES-B23 Enter after a list item starts the next item in the textarea and keeps the caret there', async () => {
    const area = await editor();
    fireEvent.change(area, { target: { value: '- one' } });
    press(area, 'Enter', 5);
    expect(area.value).toBe('- one\n- ');
    expect(area.selectionStart).toBe(8);
    press(area, 'Tab', 8);
    expect(area.value).toBe('- one\n  - ');
    press(area, 'Tab', 10, { shiftKey: true });
    expect(area.value).toBe('- one\n- ');
  });
  it('NOTES-B23 Tab off a list line and Enter in prose keep their default meaning', async () => {
    const area = await editor();
    fireEvent.change(area, { target: { value: 'prose' } });
    area.setSelectionRange(5, 5);
    const tab = fireEvent.keyDown(area, { key: 'Tab' });
    const enter = fireEvent.keyDown(area, { key: 'Enter' });
    expect(tab).toBe(true);
    expect(enter).toBe(true);
    expect(area.value).toBe('prose');
  });
  it('NOTES-B23 Ctrl+B wraps the selection, and pasting an address over it links it', async () => {
    const area = await editor();
    fireEvent.change(area, { target: { value: 'say hi now' } });
    area.setSelectionRange(4, 6);
    fireEvent.keyDown(area, { key: 'b', ctrlKey: true });
    expect(area.value).toBe('say **hi** now');
    expect([area.selectionStart, area.selectionEnd]).toEqual([6, 8]);
    fireEvent.paste(area, { clipboardData: { getData: () => 'https://a.test' } });
    expect(area.value).toBe('say **[hi](https://a.test)** now');
    // Alt combinations type characters on some layouts and are left alone.
    area.setSelectionRange(0, 3);
    fireEvent.keyDown(area, { key: 'b', ctrlKey: true, altKey: true });
    expect(area.value).toBe('say **[hi](https://a.test)** now');
  });
  it('NOTES-B23 Ctrl+Enter leaves the field, which commits the draft and shows the preview', async () => {
    const commit = vi.fn();
    mount(<MarkdownField label="Content" value="before" onCommit={commit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Content' }));
    const area = await screen.findByRole('textbox', { name: 'Content' });
    fireEvent.change(area, { target: { value: 'after' } });
    fireEvent.keyDown(area, { key: 'Enter', metaKey: true });
    fireEvent.blur(area);
    expect(commit).toHaveBeenCalledWith('after');
    expect(await screen.findByRole('button', { name: 'Content' })).toBeTruthy();
    expect((area as HTMLTextAreaElement).value).toBe('after');
  });
});
// The field inside a record: the saved value follows a commit back, or changes from outside.
const ACK = 'ack';
const OUTSIDE = 'outside';
function Record({ commits }: { commits: string[] }) {
  const [value, setValue] = useState('start');
  return (
    <>
      <MarkdownField label="Content" value={value} onCommit={(next) => commits.push(next)} />
      <button type="button" onClick={() => setValue(commits[commits.length - 1] ?? value)}>
        {ACK}
      </button>
      <button type="button" onClick={() => setValue(OUTSIDE)}>
        {OUTSIDE}
      </button>
    </>
  );
}
describe('timed commit', () => {
  it('NOTES-B24 a moved draft is committed five seconds after it moves while editing, and not otherwise', async () => {
    const commit = vi.fn();
    mount(<MarkdownField label="Content" value="" onCommit={commit} />);
    const area = await screen.findByRole('textbox', { name: 'Content' });
    vi.useFakeTimers();
    fireEvent.change(area, { target: { value: 'one' } });
    act(() => vi.advanceTimersByTime(COMMIT_EVERY_MS - 100));
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenLastCalledWith('one');
    // Nothing moved: nothing more is committed.
    act(() => vi.advanceTimersByTime(COMMIT_EVERY_MS * 2));
    expect(commit).toHaveBeenCalledTimes(1);
    // Typing on: the interval runs from the first key after a commit, not afresh per key.
    fireEvent.change(area, { target: { value: 'one two' } });
    act(() => vi.advanceTimersByTime(COMMIT_EVERY_MS - 1000));
    fireEvent.change(area, { target: { value: 'one two three' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith('one two three');
    // Leaving right after a timed commit does not commit the same text again.
    fireEvent.blur(area);
    expect(commit).toHaveBeenCalledTimes(2);
  });
  it('NOTES-B24 a commit coming back as the saved value leaves a draft that moved on alone; an outside change re-bases it', async () => {
    const commits: string[] = [];
    mount(<Record commits={commits} />);
    fireEvent.click(screen.getByRole('button', { name: 'Content' }));
    const area = (await screen.findByRole('textbox', { name: 'Content' })) as HTMLTextAreaElement;
    vi.useFakeTimers();
    fireEvent.change(area, { target: { value: 'start one' } });
    act(() => vi.advanceTimersByTime(COMMIT_EVERY_MS));
    expect(commits).toEqual(['start one']);
    fireEvent.change(area, { target: { value: 'start one two' } });
    fireEvent.click(screen.getByRole('button', { name: ACK }));
    expect(area.value).toBe('start one two');
    fireEvent.click(screen.getByRole('button', { name: OUTSIDE }));
    expect(area.value).toBe(OUTSIDE);
  });
});
describe('checklist', () => {
  it('NOTES-B25 toggles exactly the nth checklist marker in the source', () => {
    const source = '- [ ] one\n- [x] two\n> - [ ] quoted\n1. [ ] four\n- five\n[ ] not an item';
    expect(toggleChecklistItem(source, 0)).toBe(source.replace('[ ] one', '[x] one'));
    expect(toggleChecklistItem(source, 1)).toBe(source.replace('[x] two', '[ ] two'));
    expect(toggleChecklistItem(source, 2)).toBe(source.replace('[ ] quoted', '[x] quoted'));
    expect(toggleChecklistItem(source, 3)).toBe(source.replace('[ ] four', '[x] four'));
    expect(toggleChecklistItem(source, 4)).toBe(source);
  });
  it('NOTES-B25 checkboxes in the preview carry their item text as a name, and clicking one commits the toggled source', async () => {
    const commit = vi.fn();
    mount(
      <MarkdownField
        label="Content"
        value={'- [ ] Call Omar\n- [x] Send **deck**'}
        onCommit={commit}
      />,
    );
    const first = (await screen.findByRole('checkbox', { name: 'Call Omar' })) as HTMLInputElement;
    const second = screen.getByRole('checkbox', { name: 'Send deck' }) as HTMLInputElement;
    expect(first.disabled).toBe(false);
    expect([first.checked, second.checked]).toEqual([false, true]);
    fireEvent.click(second);
    expect(commit).toHaveBeenCalledWith('- [ ] Call Omar\n- [ ] Send **deck**');
    expect((screen.getByRole('checkbox', { name: 'Send deck' }) as HTMLInputElement).checked).toBe(
      false,
    );
    // The preview stays a preview: the button that opens the textarea is still there.
    expect(screen.getByRole('button', { name: 'Content' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('NOTES-B25 without a toggle the renderer keeps its checkboxes inert', () => {
    mount(<Markdown content={'- [ ] Call Omar'} />);
    expect((screen.getByRole('checkbox', { name: 'Call Omar' }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
