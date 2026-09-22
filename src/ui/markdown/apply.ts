import type { Edit } from './keys';
// Writes an edit into the textarea before reporting it, so React finds the value it is about to
// set already there and leaves the selection where the edit put it.
export function applyEdit(
  element: HTMLTextAreaElement,
  edit: Edit | null,
  onChange: (draft: string) => void,
) {
  if (!edit) return false;
  element.value = edit.text;
  element.setSelectionRange(edit.start, edit.end);
  onChange(edit.text);
  return true;
}
