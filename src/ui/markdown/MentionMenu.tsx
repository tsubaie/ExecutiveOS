'use client';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import type { MentionItem } from './mentions';
// The list under the textarea while an "@" token is being typed. Items select on mouse down so
// the textarea never loses focus; keyboard navigation is handled by the textarea itself.
export function MentionMenu({
  id,
  items,
  active,
  onPick,
}: {
  id: string;
  items: MentionItem[];
  active: number;
  onPick: (item: MentionItem) => void;
}) {
  const t = useTranslations('common');
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={t('mentionPeople')}
      className="absolute z-20 mt-1 max-h-56 w-64 max-w-full overflow-y-auto rounded-xl bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      {items.length === 0 && <li className="px-3 py-2 text-text-muted">{t('noMatches')}</li>}
      {items.map((item, index) => (
        <li
          key={item.id}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === active}
          className={cn(
            'cursor-default rounded-lg px-2.5 py-2',
            index === active && 'bg-muted text-foreground',
          )}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          <bdi>{item.name}</bdi>
        </li>
      ))}
    </ul>
  );
}
