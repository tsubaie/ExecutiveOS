'use client';
import { Suspense, lazy, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/ui/primitives/textarea';
import { cn } from '@/ui/cn';
const Markdown = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
type Mode = 'write' | 'preview';
// Markdown editing for v1 (ADR 0013): a textarea and a Write / Preview switch that renders through
// the sanitized component. The draft re-bases on the saved value when it changes from outside;
// leaving the textarea, including by switching to Preview, commits a changed draft. In preview a
// hidden input keeps `name` in plain form posts.
export function MarkdownField({
  label,
  value,
  onCommit,
  name,
  maxLength = 50000,
  className,
}: {
  label: string;
  value: string;
  onCommit?: (value: string) => void;
  name?: string;
  maxLength?: number;
  className?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('write');
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit?.(draft);
  };
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>
      {mode === 'write' ? (
        <Textarea
          id={id}
          name={name}
          dir="auto"
          value={draft}
          maxLength={maxLength}
          className="min-h-40"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      ) : (
        <Preview id={id} draft={draft} name={name} />
      )}
    </div>
  );
}
function Preview({ id, draft, name }: { id: string; draft: string; name?: string | undefined }) {
  const t = useTranslations('common');
  return (
    <div id={id} tabIndex={0} className="min-h-40 rounded-lg border px-3 py-2">
      {name && <input type="hidden" name={name} value={draft} />}
      <Suspense fallback={<div className="h-20" />}>
        {draft.trim() ? (
          <Markdown content={draft} />
        ) : (
          <p className="text-sm text-text-muted">{t('nothingToPreview')}</p>
        )}
      </Suspense>
    </div>
  );
}
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const t = useTranslations('common');
  const modes: Mode[] = ['write', 'preview'];
  return (
    <div role="group" aria-label={t('editorMode')} className="flex rounded-md border text-xs">
      {modes.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={mode === item}
          onClick={() => onChange(item)}
          className={cn(
            'min-h-7 px-2.5 first:rounded-s-md last:rounded-e-md',
            mode === item ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text',
          )}
        >
          {t(item)}
        </button>
      ))}
    </div>
  );
}
