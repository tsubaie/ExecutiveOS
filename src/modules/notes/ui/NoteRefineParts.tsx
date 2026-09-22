'use client';
import { useTranslations } from 'next-intl';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
export function SuggestedTags({
  tags,
  currentTags,
  selected,
  setSelected,
  disabled,
  bare = false,
}: {
  tags: string[];
  currentTags: string[];
  selected: number[];
  setSelected: (value: number[]) => void;
  disabled: boolean;
  // Without its own label, where the surround already names the tags.
  bare?: boolean;
}) {
  const ai = useTranslations('ai');
  if (!tags.length) return null;
  return (
    <div
      role="group"
      aria-label={ai('suggestedTags')}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      {!bare && <span className="text-sm font-medium">{ai('suggestedTags')}</span>}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <TagChip
            key={tag}
            tag={tag}
            on={selected.includes(index)}
            existing={currentTags.some((current) => current.toLowerCase() === tag.toLowerCase())}
            disabled={disabled}
            toggle={() =>
              setSelected(
                selected.includes(index)
                  ? selected.filter((value) => value !== index)
                  : [...selected, index],
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
function TagChip({
  tag,
  on,
  existing,
  disabled,
  toggle,
}: {
  tag: string;
  on: boolean;
  existing: boolean;
  disabled: boolean;
  toggle: () => void;
}) {
  const ai = useTranslations('ai');
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        'h-6 min-h-0 gap-1 rounded-full px-2 text-xs pointer-coarse:h-8',
        on
          ? 'border-accent bg-accent/15 font-semibold text-accent ring-2 ring-accent/50 hover:bg-accent/25 hover:text-accent dark:border-accent dark:bg-accent/15 dark:hover:bg-accent/25'
          : 'border-border bg-surface text-text-muted hover:bg-surface-raised dark:border-border dark:bg-surface dark:hover:bg-surface-raised',
      )}
      onClick={toggle}
    >
      {on ? (
        <Check aria-hidden={true} className="size-3" />
      ) : (
        <Plus aria-hidden={true} className="size-3" />
      )}
      <bdi>{tag}</bdi>
      {existing && <span className="text-text-muted">{ai('existingTag')}</span>}
    </Button>
  );
}
