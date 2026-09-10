'use client';
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Textarea } from '@/ui/primitives/textarea';
import { MentionMenu } from './MentionMenu';
import {
  activeMention,
  insertMention,
  matchMentions,
  type MentionItem,
  type MentionState,
  type Mentions,
} from './mentions';
type EditorProps = {
  id: string;
  name?: string | undefined;
  draft: string;
  maxLength: number;
  mentions?: Mentions | undefined;
  onChange: (draft: string) => void;
  onLeave: () => void;
};
// The textarea half of MarkdownField, loaded when the field is entered.
export default function MarkdownEditor({
  id,
  name,
  draft,
  maxLength,
  mentions,
  onChange,
  onLeave,
}: EditorProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const menu = useMentionMenu(mentions, box, onChange);
  return (
    <div className="relative">
      <Textarea
        ref={box}
        id={id}
        name={name}
        dir="auto"
        autoFocus={Boolean(draft.trim())}
        value={draft}
        maxLength={maxLength}
        className="min-h-40"
        role={menu.open ? 'combobox' : undefined}
        aria-expanded={menu.open ? true : undefined}
        aria-controls={menu.open ? menu.id(id) : undefined}
        aria-activedescendant={menu.open ? menu.activeId(id) : undefined}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange(event.target.value);
          menu.track(event.target);
        }}
        onKeyDown={menu.keyDown}
        onKeyUp={(event) => menu.track(event.currentTarget)}
        onClick={(event) => menu.track(event.currentTarget)}
        onBlur={() => {
          menu.close();
          onLeave();
        }}
      />
      {menu.open && (
        <MentionMenu id={menu.id(id)} items={menu.items} active={menu.active} onPick={menu.pick} />
      )}
    </div>
  );
}
// Tracks the "@" token at the caret, filters people and inserts the chosen name in place.
function useMentionMenu(
  mentions: Mentions | undefined,
  box: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (draft: string) => void,
) {
  const [token, setToken] = useState<MentionState | null>(null);
  const [active, setActive] = useState(0);
  // The token start that was picked or dismissed: the menu stays closed for it until the caret
  // leaves it, because a picked name keeps looking like a token being typed (mentions.ts).
  const [dismissed, setDismissed] = useState<number | null>(null);
  const items = token && mentions ? matchMentions(mentions.items, token.query) : [];
  const id = (fieldId: string) => `${fieldId}-mentions`;
  const close = (start: number | null) => {
    setToken(null);
    setDismissed(start);
  };
  const track = (element: HTMLTextAreaElement) => {
    if (!mentions) return;
    const next = activeMention(element.value, element.selectionStart, mentions.items, dismissed);
    if (!next) return close(null);
    if (next === 'dismissed') return setToken(null);
    if (token?.start !== next.start || token.query !== next.query) setActive(0);
    setToken(next);
  };
  const pick = (item: MentionItem) => {
    const element = box.current;
    if (!element || !token || !mentions) return;
    const next = insertMention(element.value, token, element.selectionStart, item.name);
    onChange(next.text);
    close(token.start);
    mentions.onPick(item);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    });
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) =>
    token && menuKey(event, { items, active, setActive, pick, dismiss: () => close(token.start) });
  return {
    open: Boolean(token),
    items,
    active,
    id,
    activeId: (fieldId: string) => (items[active] ? `${id(fieldId)}-${active}` : undefined),
    track,
    close: () => setToken(null),
    pick,
    keyDown,
  };
}
// Keyboard handling while the menu is open: arrows move and wrap, Enter or Tab pick, Escape closes.
function menuKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  menu: {
    items: MentionItem[];
    active: number;
    setActive: (update: (index: number) => number) => void;
    pick: (item: MentionItem) => void;
    dismiss: () => void;
  },
) {
  const { items, active } = menu;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    menu.setActive((index) => (items.length ? (index + step + items.length) % items.length : 0));
  } else if ((event.key === 'Enter' || event.key === 'Tab') && items[active]) {
    event.preventDefault();
    menu.pick(items[active]);
  } else if (event.key === 'Escape') {
    event.stopPropagation();
    menu.dismiss();
  }
}
