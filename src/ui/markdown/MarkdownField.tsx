'use client';
import { Suspense, lazy, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import type { Mentions } from './mentions';
// Both halves load on demand: the renderer only when there is content to show, the editor only
// when the field is entered, so neither weighs on a route's initial bundle.
const Markdown = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
const Editor = lazy(() => import('./MarkdownEditor'));
type Props = {
  label: string;
  value: string;
  onCommit?: (value: string) => void;
  name?: string;
  maxLength?: number;
  className?: string;
  mentions?: Mentions;
};
// Markdown editing (ADR 0015): the field shows the rendered preview and becomes a textarea when
// entered; leaving it commits a changed draft and shows the preview again. Empty content stays a
// textarea, since there is nothing to preview. With `mentions`, typing "@" opens a list of people
// and picking one inserts "@Name" and reports the pick. The draft re-bases on the saved value when
// it changes from outside; in preview a hidden input keeps `name` in plain form posts.
export function MarkdownField({
  label,
  value,
  onCommit,
  name,
  maxLength = 50000,
  className,
  mentions,
}: Props) {
  const id = useId();
  const [editing, setEditing] = useState(!value.trim());
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const leave = () => {
    if (draft !== value) onCommit?.(draft);
    if (draft.trim()) setEditing(false);
  };
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {editing ? (
        <Suspense fallback={<div className="min-h-40 rounded-lg border" />}>
          <Editor
            id={id}
            name={name}
            draft={draft}
            maxLength={maxLength}
            mentions={mentions}
            onChange={setDraft}
            onLeave={leave}
          />
        </Suspense>
      ) : (
        <Preview id={id} label={label} draft={draft} name={name} edit={() => setEditing(true)} />
      )}
    </div>
  );
}
// The rendered content as a button: activating it opens the textarea. Links render as text here
// because a control cannot contain another control; the field's label names the button.
function Preview({
  id,
  label,
  draft,
  name,
  edit,
}: {
  id: string;
  label: string;
  draft: string;
  name?: string | undefined;
  edit: () => void;
}) {
  const t = useTranslations('common');
  return (
    <div className="grid">
      {name && <input type="hidden" name={name} value={draft} />}
      <button
        type="button"
        id={id}
        aria-label={label}
        title={t('clickToWrite')}
        className="min-h-40 w-full cursor-text rounded-lg border px-3 py-2 text-start hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={edit}
      >
        <Suspense fallback={<div className="h-20" />}>
          <Markdown content={draft} interactive={false} />
        </Suspense>
      </button>
    </div>
  );
}
