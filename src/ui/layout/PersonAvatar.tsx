'use client';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import { initials } from '@/ui/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
// PEOPLE-B09: initials alone identify nobody — an Arabic given name reduces to a single letter —
// and a title tooltip never appears on touch. The trigger carries the full name as its accessible
// name, so assistive technology reads it without opening anything, and pressing or tapping reveals
// the same name visually. It must be rendered outside an interactive ancestor (EP-B20).
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const t = useTranslations('people');
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('showName', { name })}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-text outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
      >
        <bdi aria-hidden>{initials(name)}</bdi>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto max-w-64 px-3 py-2">
        <span dir="auto" className="block text-sm font-medium">
          {name}
        </span>
      </PopoverContent>
    </Popover>
  );
}
