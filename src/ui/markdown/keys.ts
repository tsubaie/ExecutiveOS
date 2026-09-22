// Keystroke helpers for the markdown textarea (NOTES-B23). Each one is pure: the text and the
// selection go in, the edited text and selection come out, or null when the key should keep its
// default meaning. The editor applies the result to the textarea and reports the new text.
export type Edit = { text: string; start: number; end: number };
export type Key = { key: string; mod: boolean; shift: boolean };
// A list marker: indent, bullet or number, the gap after it, and an optional checkbox.
const LIST = /^([ \t]*)([-*+]|\d+[.)])([ \t]+)(\[[ xX]\][ \t]+)?/u;
const URL = /^https?:\/\/\S+$/u;
function lineAt(text: string, at: number) {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const stop = text.indexOf('\n', at);
  return { start, end: stop < 0 ? text.length : stop };
}
function marker(text: string, lineStart: number, lineEnd: number) {
  const match = LIST.exec(text.slice(lineStart, lineEnd));
  if (!match) return null;
  const [whole, indent = '', bullet = '', gap = '', box = ''] = match;
  return { whole, indent, bullet, gap, box };
}
// Enter inside a list item starts the next item with the same marker: numbers advance and a
// checkbox comes back unchecked. Enter on an item that is only its marker ends the list instead.
export function continueList(text: string, start: number, end: number): Edit | null {
  if (start !== end) return null;
  const line = lineAt(text, start);
  const item = marker(text, line.start, line.end);
  if (!item || start - line.start < item.whole.length) return null;
  if (!text.slice(line.start + item.whole.length, line.end).trim()) {
    const next = text.slice(0, line.start) + text.slice(line.end);
    return { text: next, start: line.start, end: line.start };
  }
  const number = /^\d+/u.exec(item.bullet);
  const bullet = number
    ? `${Number(number[0]) + 1}${item.bullet.slice(number[0].length)}`
    : item.bullet;
  const box = item.box ? `[ ]${item.box.slice(3)}` : '';
  const inserted = `\n${item.indent}${bullet}${item.gap}${box}`;
  const next = text.slice(0, start) + inserted + text.slice(start);
  return { text: next, start: start + inserted.length, end: start + inserted.length };
}
// Tab on a list line indents it by its marker's width, which nests it under the item above;
// Shift+Tab takes one such indent away. A selection spanning lines shifts every list line in it.
// Off a list line, Tab keeps moving focus.
export function shiftList(text: string, start: number, end: number, outdent: boolean): Edit | null {
  const first = lineAt(text, start);
  if (!marker(text, first.start, first.end)) return null;
  const last = lineAt(text, end);
  const lines = text.slice(first.start, last.end).split('\n');
  let firstDelta = 0;
  let total = 0;
  const shifted = lines.map((line, index) => {
    const item = marker(line, 0, line.length);
    if (!item) return line;
    const width = item.bullet.length + item.gap.length;
    const next = outdent
      ? line.replace(new RegExp(`^[ \\t]{0,${width}}`, 'u'), '')
      : ' '.repeat(width) + line;
    const delta = next.length - line.length;
    if (index === 0) firstDelta = delta;
    total += delta;
    return next;
  });
  const next = text.slice(0, first.start) + shifted.join('\n') + text.slice(last.end);
  // A selection anchored at the line start stays anchored there, so it still covers the line.
  return {
    text: next,
    start: start === first.start ? start : Math.max(first.start, start + firstDelta),
    end: Math.max(first.start, end + total),
  };
}
// Wraps the selection in a marker such as ** or *, or removes the marker when the selection is
// already wrapped in it. With nothing selected the caret lands between a fresh pair.
export function wrapSelection(text: string, start: number, end: number, mark: string): Edit {
  const width = mark.length;
  const inside = text.slice(start, end);
  const before = text.slice(start - width, start);
  const after = text.slice(end, end + width);
  if (start >= width && before === mark && after === mark)
    return {
      text: text.slice(0, start - width) + inside + text.slice(end + width),
      start: start - width,
      end: end - width,
    };
  if (inside.length >= width * 2 && inside.startsWith(mark) && inside.endsWith(mark))
    return {
      text: text.slice(0, start) + inside.slice(width, -width) + text.slice(end),
      start,
      end: end - width * 2,
    };
  return {
    text: text.slice(0, start) + mark + inside + mark + text.slice(end),
    start: start + width,
    end: end + width,
  };
}
// Turns the selection into a link: selected text becomes the label and the caret waits in the
// empty address; a selected address becomes the target and the caret waits in the empty label.
export function linkSelection(text: string, start: number, end: number): Edit {
  const inside = text.slice(start, end);
  if (URL.test(inside)) {
    const next = `${text.slice(0, start)}[](${inside})${text.slice(end)}`;
    return { text: next, start: start + 1, end: start + 1 };
  }
  const next = `${text.slice(0, start)}[${inside}]()${text.slice(end)}`;
  const caret = start + inside.length + 3;
  return { text: next, start: caret, end: caret };
}
// Pasting an address over a selection links the selection to it instead of replacing it.
export function pasteLink(text: string, start: number, end: number, pasted: string): Edit | null {
  const url = pasted.trim();
  if (start === end || !URL.test(url)) return null;
  const next = `${text.slice(0, start)}[${text.slice(start, end)}](${url})${text.slice(end)}`;
  const caret = end + url.length + 4;
  return { text: next, start: caret, end: caret };
}
// The edit a key asks for, if any. The modifier is Ctrl or Command; Alt is left alone because
// with Ctrl it types characters on some layouts.
export function editForKey(text: string, start: number, end: number, key: Key): Edit | null {
  if (key.mod) {
    const letter = key.key.toLowerCase();
    if (letter === 'b') return wrapSelection(text, start, end, '**');
    if (letter === 'i') return wrapSelection(text, start, end, '*');
    if (letter === 'k') return linkSelection(text, start, end);
    return null;
  }
  if (key.key === 'Enter' && !key.shift) return continueList(text, start, end);
  if (key.key === 'Tab') return shiftList(text, start, end, key.shift);
  return null;
}
