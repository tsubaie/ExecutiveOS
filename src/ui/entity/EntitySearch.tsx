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
  const value = draft.source === query ? draft.value : query;
  // sync: debounce the search draft into the URL; external URL changes override stale drafts.
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => navigate({ q: value }, true), 250);
    return () => clearTimeout(timer);
  }, [value, query, navigate]);
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      <Input
        className="ps-9"
        aria-label={t('search')}
        placeholder={t('search')}
        value={value}
        onChange={(event) => setDraft({ source: query, value: event.target.value })}
      />
    </div>
  );
}
