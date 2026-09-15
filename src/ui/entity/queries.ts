import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Entity, ListResult } from './types';
// Every module's list hook turns the same shape of paged response into the same `ListResult`. That
// mapping is the framework's contract rather than each module's business, so it lives here: five
// copies of it drift, and the one that drifts is the one nobody looks at.
type Page<T> = { data: T[]; meta: { counts?: Record<string, number>; nextCursor: string | null } };
export function listResult<T extends Entity>(
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>, Error>,
): ListResult<T> {
  return {
    items: query.data?.pages.flatMap((page) => page.data) ?? [],
    counts: query.data?.pages[0]?.meta.counts ?? {},
    pending: query.isPending,
    error: query.error,
    more: query.hasNextPage,
    fetchMore: async () => {
      await query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
