'use client';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import type { Filters } from '@/ui/entity/types';
import { Committee, CommitteeList, CommitteeChoices, Activity, type CommitteeCreate, type CommitteePatch, Reorder } from '../schema/validation';
const response = z.object({ data: Committee });
export function useCommittees(filters: Filters) {
  const query = useInfiniteQuery({ queryKey: ['committees', 'list', filters], initialPageParam: '',
    queryFn: ({ pageParam }) => request(`/committees?${new URLSearchParams(Object.entries({ ...filters, cursor: pageParam }).filter(([, value]) => value !== ''))}`, CommitteeList),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined, refetchInterval: 30000,
    placeholderData: keepPreviousData });
  return { items: query.data?.pages.flatMap((page) => page.data) ?? [], counts: query.data?.pages[0]?.meta.counts ?? {},
    summaryCounts: query.data?.pages[0]?.meta.taskStats, defaultView: 'active', pending: query.isPending, error: query.error,
    more: query.hasNextPage, fetchMore: async () => { await query.fetchNextPage(); }, refetch: () => { void query.refetch(); } };
}
export function useCommittee(id: string | null, trash: boolean) {
  const query = useQuery({ queryKey: ['committees', 'detail', id, trash], enabled: Boolean(id),
    queryFn: () => request(`/committees/${id}?includeDeleted=${trash}`, response) });
  return { data: query.data?.data, pending: query.isLoading, error: query.error, refetch: async () => (await query.refetch()).data?.data };
}
export function useCommitteeChoices(current?: string | null) {
  return useQuery({ queryKey: ['committees', 'choices', current],
    queryFn: () => request(`/committees/choices${current ? `?current=${current}` : ''}`, CommitteeChoices) });
}
export function useCommitteeActivity(id: string) {
  return useInfiniteQuery({ queryKey: ['committees', 'activity', id], initialPageParam: '',
    queryFn: ({ pageParam }) => request(`/committees/${id}/activity${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, Activity),
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined });
}
export function useCommitteeMutations() {
  const client = useQueryClient();
  async function write<S extends z.ZodType>(path: string, schema: S, body: z.infer<ReturnType<typeof z.json>>, method = 'POST', key?: string) {
    try { return await request(path, schema, { body, method, ...(key ? { key } : {}) }); }
    finally { await Promise.all(['committees', 'tasks', 'notes', 'home'].map((queryKey) => client.invalidateQueries({ queryKey: [queryKey] }))); }
  }
  return {
    create: async (input: CommitteeCreate) => (await write('/committees', response, input)).data,
    patch: async (id: string, revision: number, fields: Omit<CommitteePatch, 'revision'>, key: string) => (await write(`/committees/${id}`, response, z.json().parse({ ...fields, revision }), 'PATCH', key)).data,
    // The delete reports itself the moment the server has taken it. Awaiting the invalidation here
    // put every dependent query's refetch between the press and the panel closing, so the record
    // sat on screen for a second after it was gone. The refresh still runs, just not in the way.
    remove: async (id: string, revision: number) => {
      try {
        return await request(`/committees/${id}`, z.object({ opId: z.uuid() }), { method: 'DELETE', body: { revision } });
      } finally {
        void Promise.all(['committees', 'tasks', 'notes', 'home'].map((queryKey) => client.invalidateQueries({ queryKey: [queryKey] })));
      }
    },
    restore: async (id: string, opId: string) => (await write(`/committees/${id}/restore`, response, { opId })).data,
    reorder: (items: z.infer<typeof Reorder>['items']) => write('/committees/reorder', z.object({ data: z.object({ updatedIds: z.array(z.uuid()) }) }), { items }, 'PATCH'),
  };
}
