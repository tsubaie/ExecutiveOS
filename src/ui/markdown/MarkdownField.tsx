'use client';
import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import type { Mentions } from './mentions';
import { toggleChecklistItem } from './checklist';
import { FieldFrame, FieldLabel, type Expand } from './ExpandedField';
// Both halves load on demand: the renderer only when there is content to show, the editor only
// when the field is entered, so neither weighs on a route's initial bundle.
const Markdown = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
const Editor = lazy(() => import('./MarkdownEditor'));
// NOTES-B24: while the field is being edited, a draft is committed this long after it first
// moves away from the last commit.
export const COMMIT_EVERY_MS = 5000;
type Props = {
  label: string;
  value: string;
  onCommit?: (value: string) => void;
  name?: string;
  maxLength?: number;
  className?: string;
  mentions?: Mentions;
  // Rendered on the label row: an action that transforms this field, or the notice standing in for
  // one that is unavailable.
  action?: ReactNode;
  // EP-B44: the field can move into the expanded view. `title` heads that view; the labels name
  // the control both ways; `open` is owned by the caller, who carries it in the URL.
  expand?: Expand;
};
type Commit = ((value: string) => void) | undefined;
// What the field has committed and is still waiting to see come back. A saved value that returns
// equal to one of those commits is this field's own round trip, so the draft, which may have
// moved on, is left alone; any other change to the saved value is from outside and re-bases it.
class Commits {
  private sent: string[] = [];
  private last: string;
  // When the draft first moved away from the last commit, while it is away.
  private movedAt: number | null = null;
  constructor(initial: string) {
    this.last = initial;
  }
  commit(next: string, onCommit: Commit) {
    this.sent.push(next);
    this.last = next;
    this.movedAt = null;
    onCommit?.(next);
  }
  own(incoming: string) {
    return this.sent.includes(incoming);
  }
  // The saved value has arrived: forget the commits it answers, or take it as the new base.
  settle(incoming: string) {
    const index = this.sent.indexOf(incoming);
    if (index >= 0) this.sent.splice(0, index + 1);
    else {
      this.sent = [];
      this.last = incoming;
    }
  }
  moved(draft: string) {
    return draft !== this.last;
  }
  // How long until a moved draft is due: the interval runs from its first move, not per key.
  due() {
    this.movedAt ??= Date.now();
    return Math.max(0, COMMIT_EVERY_MS - (Date.now() - this.movedAt));
  }
}
// The draft and whether the field is being edited. Leaving commits a moved draft; a timer commits
// one five seconds after it moves while editing (NOTES-B24); a checklist toggle commits at once
// (B25).
function useDraft(value: string, onCommit: Commit) {
  const [editing, setEditing] = useState(!value.trim());
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [commits] = useState(() => new Commits(value));
  if (seen !== value) {
    setSeen(value);
    if (!commits.own(value)) setDraft(value);
  }
  // sync: the saved value has come back; the field's commit log settles on it.
  useEffect(() => commits.settle(value), [commits, value]);
  // sync: a timer commits a moved draft five seconds after it first moved, while editing.
  useEffect(() => {
    if (!editing || !commits.moved(draft)) return;
    const timer = setTimeout(() => commits.commit(draft, onCommit), commits.due());
    return () => clearTimeout(timer);
  }, [commits, draft, editing, onCommit]);
  const leave = () => {
    if (commits.moved(draft)) commits.commit(draft, onCommit);
    if (draft.trim()) setEditing(false);
  };
  const toggle = (index: number) => {
    const next = toggleChecklistItem(draft, index);
    if (next === draft) return;
    setDraft(next);
    commits.commit(next, onCommit);
  };
  return { editing, draft, setDraft, leave, toggle, enter: () => setEditing(true) };
}
// Markdown editing (ADR 0015): the field shows the rendered preview and becomes a textarea when
// entered; leaving it commits a changed draft and shows the preview again, and while it is being
// edited a moved draft is also committed every five seconds (NOTES-B24). Empty content stays a
// textarea, since there is nothing to preview. With `mentions`, typing "@" opens a list of people
// and picking one inserts "@Name" and reports the pick. Checklist boxes in the preview toggle
// their item in place (NOTES-B25). The draft re-bases on the saved value when it changes from
// outside; in preview a hidden input keeps `name` in plain form posts.
export function MarkdownField({
  label,
  value,
  onCommit,
  name,
  maxLength = 50000,
  className,
  mentions,
  action,
  expand,
}: Props) {
  const id = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const { editing, draft, setDraft, leave, toggle, enter } = useDraft(value, onCommit);
  const body = (
    <div className={cn('grid gap-2', className)}>
      <FieldLabel id={id} label={label} action={action} expand={expand} />
      {editing ? (
        <Suspense
          fallback={
            <div className={cn('rounded-lg border', draft.trim() ? 'min-h-40' : 'min-h-20')} />
          }
        >
          <Editor
            id={id}
            name={name}
            draft={draft}
            maxLength={maxLength}
            mentions={mentions}
            caret={caret}
            toolbar={Boolean(expand?.open)}
            onChange={setDraft}
            onLeave={leave}
          />
        </Suspense>
      ) : (
        <Preview
          id={id}
          label={label}
          draft={draft}
          name={name}
          toggle={toggle}
          edit={(at) => {
            setCaret(at);
            enter();
          }}
        />
      )}
    </div>
  );
  return (
    <FieldFrame id={id} label={label} className={className} expand={expand}>
      {body}
    </FieldFrame>
  );
}
// The rendered content over a button that opens the textarea. The content lets pointer events
// through to the button beneath it, except its checklist boxes, which toggle in place; the two
// are siblings because a control cannot contain another control, and links render as text.
function Preview({
  id,
  label,
  draft,
  name,
  edit,
  toggle,
}: {
  id: string;
  label: string;
  draft: string;
  name?: string | undefined;
  edit: (caret: number | null) => void;
  toggle: (index: number) => void;
}) {
  const t = useTranslations('common');
  const box = useRef<HTMLDivElement>(null);
  // A pointer click lands the caret where it hit; keyboard activation lands it at the end.
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    const root = event.detail > 0 ? box.current : null;
    if (!root) return edit(null);
    const { clientX, clientY } = event;
    // Loaded on demand: the mapping is only needed for pointer clicks and stays out of routes.
    void import('./caret').then(({ sourceOffsetFromPoint }) => {
      // Hit testing for the caret needs the content solid for a moment.
      root.classList.remove('pointer-events-none');
      const at = sourceOffsetFromPoint(root, clientX, clientY, draft);
      root.classList.add('pointer-events-none');
      edit(at);
    });
  };
  return (
    <div className={cn('relative grid', draft.trim() ? 'min-h-40' : 'min-h-20')}>
      {name && <input type="hidden" name={name} value={draft} />}
      <button
        type="button"
        id={id}
        aria-label={label}
        title={t('clickToWrite')}
        className="absolute inset-0 cursor-text rounded-lg border hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={click}
      />
      <div ref={box} className="pointer-events-none relative px-3 py-2">
        <Suspense fallback={<div className="h-20" />}>
          <Markdown content={draft} interactive={false} onToggle={toggle} />
        </Suspense>
      </div>
    </div>
  );
}
