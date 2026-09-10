export type MentionItem = { id: string; name: string };
export type MentionState = { start: number; query: string };
export type Mentions = { items: MentionItem[]; onPick: (item: MentionItem) => void };
// The "@query" token that ends at the caret, if any: an "@" at the start or after whitespace,
// followed by anything except another "@" or a line break.
export function mentionAt(text: string, caret: number): MentionState | null {
  const before = text.slice(0, caret);
  const match = /(?:^|\s)@([^@\n]*)$/u.exec(before);
  if (!match) return null;
  return {
    start: caret - match[0].length + (match[0].startsWith('@') ? 0 : 1),
    query: match[1] ?? '',
  };
}
export function matchMentions(items: MentionItem[], query: string, limit = 8) {
  const needle = query.trim().toLowerCase();
  return items
    .filter((item) => !needle || item.name.toLowerCase().includes(needle))
    .slice(0, limit);
}
// Replaces the active token with "@Name " and returns the new text and caret position.
export function insertMention(text: string, state: MentionState, caret: number, name: string) {
  const inserted = `@${name} `;
  const next = text.slice(0, state.start) + inserted + text.slice(caret);
  return { text: next, caret: state.start + inserted.length };
}
// The token the menu should show for the caret, if any: none while it is the token that was
// just picked or dismissed, and none for a multi-word query that matches nobody, which is prose
// after an "@" rather than a search.
export function activeMention(
  text: string,
  caret: number,
  items: MentionItem[],
  dismissed: number | null,
) {
  const next = mentionAt(text, caret);
  if (!next || next.start === dismissed) return next ? 'dismissed' : null;
  if (/\s/u.test(next.query) && !matchMentions(items, next.query).length) return 'dismissed';
  return next;
}
