'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input } from '@/ui/primitives/input';
export function EntitySearch({
  query,
  navigate,
}: {
  query: string;
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void;
}) {
  const t = useTranslations('common');
  const [draft, setDraft] = useState({ source: query, value: query });
  const [submitted, setSubmitted] = useState<string | null>(null);
  const value = draft.source === query || submitted === query ? draft.value : query;
  if (draft.source !== query) setDraft({ source: query, value });
  // sync: debounce the search draft into the URL; external URL changes override stale drafts.
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => { setSubmitted(value); navigate({ q: value }, true); }, 250);
    return () => clearTimeout(timer);
  }, [value, query, navigate]);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input ps-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <Search aria-hidden={true} className="pointer-events-none size-4 shrink-0 text-text-muted" />
      <Input
        className="flex-1 border-0 bg-transparent ps-0 focus-visible:ring-0 dark:bg-transparent"
        aria-label={t('search')}
        placeholder={t('search')}
        value={value}
        onChange={(event) => setDraft({ source: query, value: event.target.value })}
      />
    </div>
  );
}
