'use client';
import { Fragment, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Bold, Heading2, Heading3, Italic, List, ListChecks } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { applyEdit } from './apply';
import { toggleHeading, toggleLines, wrapSelection, type Edit } from './keys';
type Make = (text: string, start: number, end: number) => Edit;
// NOTES-B28: the formatting actions the expanded view offers beside the keys (B23), as a strip
// pinned to the top of the text: title and subtitle, a hairline, inline styles, a hairline, then
// the two list kinds. Targets
// are 40 px, 44 px under a coarse pointer, and carry their name beside the icon when there is
// room. A press keeps focus in the text, otherwise leaving the textarea would commit it and show
// the preview.
export function EditorToolbar({
  box,
  onChange,
}: {
  box: RefObject<HTMLTextAreaElement | null>;
  onChange: (draft: string) => void;
}) {
  const t = useTranslations('common');
  const items = tools(t);
  const run = (make: Make) => {
    const element = box.current;
    if (!element) return;
    applyEdit(element, make(element.value, element.selectionStart, element.selectionEnd), onChange);
    element.focus();
  };
  return (
    <div
      role="toolbar"
      aria-label={t('formatting')}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-lg border bg-surface-raised/95 p-1 backdrop-blur"
    >
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {(index === 2 || index === 4) && <span aria-hidden className="mx-1 h-6 w-px bg-border" />}
          <ToolButton label={item.label} icon={item.icon} onPress={() => run(item.make)} />
        </Fragment>
      ))}
    </div>
  );
}
function ToolButton({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: typeof Bold;
  onPress: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      className="h-10 min-w-10 gap-2 px-3 text-sm pointer-coarse:h-11 pointer-coarse:min-w-11"
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      <Icon className="size-4.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
type Tool = { label: string; icon: typeof Bold; make: Make };
function tools(t: ReturnType<typeof useTranslations<'common'>>): Tool[] {
  return [
    {
      label: t('headingTitle'),
      icon: Heading2,
      make: (text, start, end) => toggleHeading(text, start, end, 2),
    },
    {
      label: t('headingSubtitle'),
      icon: Heading3,
      make: (text, start, end) => toggleHeading(text, start, end, 3),
    },
    {
      label: t('bold'),
      icon: Bold,
      make: (text, start, end) => wrapSelection(text, start, end, '**'),
    },
    {
      label: t('italic'),
      icon: Italic,
      make: (text, start, end) => wrapSelection(text, start, end, '*'),
    },
    {
      label: t('bulletList'),
      icon: List,
      make: (text, start, end) => toggleLines(text, start, end, 'bullet'),
    },
    {
      label: t('checklist'),
      icon: ListChecks,
      make: (text, start, end) => toggleLines(text, start, end, 'checklist'),
    },
  ];
}
