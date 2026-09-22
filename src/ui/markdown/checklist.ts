// Checklist items in markdown source (NOTES-B25): a list marker followed by `[ ]` or `[x]`. The
// nth rendered checkbox is the nth such marker in source order, so a toggle from the preview
// flips exactly that marker and nothing else in the text.
const ITEM = /^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])(\](?=[ \t]|$))/gmu;
export function toggleChecklistItem(source: string, index: number): string {
  let seen = 0;
  return source.replace(ITEM, (whole: string, head: string, mark: string, tail: string) =>
    seen++ === index ? `${head}${mark === ' ' ? 'x' : ' '}${tail}` : whole,
  );
}
