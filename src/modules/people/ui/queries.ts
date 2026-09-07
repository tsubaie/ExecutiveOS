'use client';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import {
  Person,
  PersonList,
  PersonCreated,
  type PersonCreate,
  PersonPatch,
} from '../schema/validation';
import type { Filters } from '@/ui/entity/types';
export function usePeople(filters: Filters) {
  const result = useInfiniteQuery({
    queryKey: ['people', 'list', filters],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request(
        `/people?${new URLSearchParams({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) })}`,
        PersonList,
      ),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  return {
    items: result.data?.pages.flatMap((page) => page.data) ?? [],
    counts: result.data?.pages[0]?.meta.counts ?? {},
    pending: result.isPending,
    error: result.error,
    more: result.hasNextPage,
    fetchMore: async () => {
      await result.fetchNextPage();
    },
    refetch: () => {
      void result.refetch();
    },
  };
}
export function usePerson(id: string | null, trash: boolean) {
  const result = useQuery({
    queryKey: ['people', 'detail', id, trash],
    enabled: Boolean(id),
    queryFn: () => request(`/people/${id}?includeDeleted=${trash}`, z.object({ data: Person })),
  });
  return {
    data: result.data?.data,
    pending: result.isLoading,
    error: result.error,
    refetch: async () => {
      const response = await result.refetch();
      return response.data?.data;
    },
  };
}
export function usePeopleMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['people'] });
  return {
    patch: async (
      id: string,
      revision: number,
      patch: Omit<z.infer<typeof PersonPatch>, 'revision'>,
      key: string,
    ) => {
      try {
        return (
          await request(`/people/${id}`, z.object({ data: Person }), {
            method: 'PATCH',
            body: z.json().parse({ ...patch, revision }),
            key,
          })
        ).data;
      } finally {
        await refresh();
      }
    },
    create: async (input: PersonCreate) => {
      const result = await request('/people', PersonCreated, { method: 'POST', body: input });
      await refresh();
      return result.data;
    },
    remove: async (id: string, revision: number) => {
      const result = await request(`/people/${id}`, z.object({ opId: z.string() }), {
        method: 'DELETE',
        body: { revision },
      });
      await refresh();
      return result;
    },
    restore: async (id: string, opId: string) => {
      const result = await request(`/people/${id}/restore`, z.object({ data: Person }), {
        method: 'POST',
        body: { opId },
      });
      await refresh();
      return result.data;
    },
  };
}
