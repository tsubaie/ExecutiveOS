// Entering the preview with a click should put the caret where the click landed (notes.md § UI).
// The rendered text under the pointer is looked up in the markdown source: rendered text nodes
// are substrings of the source in almost every case (markup only surrounds them), so the nth
// rendered occurrence of that text maps to the nth occurrence in the source.
export function sourceOffset(
  source: string,
  texts: readonly string[],
  index: number,
  offset: number,
): number | null {
  const text = texts[index];
  if (text === undefined) return null;
  const needle = text.trim() ? text : null;
  if (!needle) return null;
  const nth = texts.slice(0, index).filter((other) => other === text).length;
  let from = 0;
  for (let seen = 0; ; seen++) {
    const at = source.indexOf(needle, from);
    if (at < 0) return null;
    if (seen === nth) return Math.min(source.length, at + offset);
    from = at + needle.length;
  }
}
function textNodes(root: Node) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if (node instanceof Text) nodes.push(node);
  return nodes;
}
type CaretPoint = { offsetNode: Node; offset: number };
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPoint | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};
// The source position for a pointer position inside `root`, or null when the browser cannot
// resolve a caret there (a click on padding, or an older engine).
function caretAt(x: number, y: number): CaretPoint | null {
  const doc: CaretDocument = document;
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return position;
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { offsetNode: range.startContainer, offset: range.startOffset } : null;
}
export function sourceOffsetFromPoint(root: HTMLElement, x: number, y: number, source: string) {
  const hit = caretAt(x, y);
  if (!hit || !(hit.offsetNode instanceof Text) || !root.contains(hit.offsetNode)) return null;
  const nodes = textNodes(root);
  return sourceOffset(
    source,
    nodes.map((item) => item.data),
    nodes.indexOf(hit.offsetNode),
    hit.offset,
  );
}
