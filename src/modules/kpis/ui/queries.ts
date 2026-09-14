'use client';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import type { Filters } from '@/ui/entity/types';
import {
  KpiDetail,
  KpiList,
  KpiFacets,
  Objective,
  ObjectiveList,
  type KpiCreate,
  type KpiPatch,
  type ObjectiveCreate,
  type ObjectivePatch,
  type ReadingCreate,
  type ReadingPatch,
  type TargetsPut,
} from '../schema/validation';
const record = z.object({ data: KpiDetail });
const objective = z.object({ data: Objective });
const opId = z.object({ opId: z.uuid() });
// KPIS-B12: a reading, a target or a threshold changes a status, and a status changes the lists,
// the counts and Home. Every write invalidates all four rather than guessing which one moved.
const touched = ['kpis', 'objectives', 'home'];
export function useKpis(filters: Filters) {
  const query = useInfiniteQuery({
    queryKey: ['kpis', 'list', filters],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request(
        `/kpis?${new URLSearchParams(Object.entries({ ...filters, cursor: pageParam }).filter(([, value]) => value !== ''))}`,
        KpiList,
      ),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    refetchInterval: 60000,
  });
  return {
    items: query.data?.pages.flatMap((page) => page.data) ?? [],
    counts: query.data?.pages[0]?.meta.counts ?? {},
    defaultView: 'all',
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
// The detail endpoint answers with the whole record, so the framework's row object and the panel's
// readings and targets come from one request and one cache entry.
export function useKpi(id: string | null, trash: boolean) {
  const query = useQuery({
    queryKey: ['kpis', 'detail', id, trash],
    enabled: Boolean(id),
    queryFn: () => request(`/kpis/${id}?includeDeleted=${trash}`, record),
  });
  return {
    data: query.data?.data,
    pending: query.isLoading,
    error: query.error,
    refetch: async () => (await query.refetch()).data?.data,
  };
}
export function useKpiFacets() {
  return useQuery({
    queryKey: ['kpis', 'facets'],
    queryFn: () => request('/kpis/facets', KpiFacets),
  });
}
export function useObjectives() {
  return useQuery({
    queryKey: ['objectives', 'list'],
    queryFn: () => request('/objectives', ObjectiveList),
  });
}
function useWrite() {
  const client = useQueryClient();
  return async function write<S extends z.ZodType>(
    path: string,
    schema: S,
    body?: z.infer<ReturnType<typeof z.json>>,
    method = 'POST',
    key?: string,
  ) {
    try {
      return await request(path, schema, {
        method,
        ...(body === undefined ? {} : { body }),
        ...(key ? { key } : {}),
      });
    } finally {
      await Promise.all(
        touched.map((queryKey) => client.invalidateQueries({ queryKey: [queryKey] })),
      );
    }
  };
}
export function useKpiMutations() {
  const write = useWrite();
  return {
    create: async (input: KpiCreate) => (await write('/kpis', record, z.json().parse(input))).data,
    patch: async (id: string, revision: number, fields: Omit<KpiPatch, 'revision'>, key: string) =>
      (await write(`/kpis/${id}`, record, z.json().parse({ ...fields, revision }), 'PATCH', key))
        .data,
    remove: (id: string, revision: number) => write(`/kpis/${id}`, opId, { revision }, 'DELETE'),
    restore: async (id: string, opId: string) =>
      (await write(`/kpis/${id}/restore`, record, { opId })).data,
  };
}
export function useReadingMutations(kpiId: string) {
  const write = useWrite();
  return {
    add: (input: ReadingCreate) => write(`/kpis/${kpiId}/readings`, record, z.json().parse(input)),
    overwrite: (day: string, input: { value: number; note: string }) =>
      write(`/kpis/${kpiId}/readings/${day}`, record, input, 'PUT'),
    patch: (readingId: string, input: ReadingPatch) =>
      write(`/kpis/${kpiId}/readings/${readingId}`, record, z.json().parse(input), 'PATCH'),
    remove: (readingId: string) =>
      write(`/kpis/${kpiId}/readings/${readingId}`, opId, undefined, 'DELETE'),
  };
}
export function useTargetMutations(kpiId: string) {
  const write = useWrite();
  return {
    put: (input: TargetsPut) =>
      write(`/kpis/${kpiId}/targets`, record, z.json().parse(input), 'PUT'),
    remove: (targetId: string) =>
      write(`/kpis/${kpiId}/targets/${targetId}`, opId, undefined, 'DELETE'),
  };
}
export function useObjectiveOrder() {
  const write = useWrite();
  const result = z.object({ data: z.object({ updatedIds: z.array(z.uuid()) }) });
  return (items: { id: string; revision: number }[]) =>
    write('/objectives/reorder', result, { items }, 'PATCH');
}
export function useObjectiveMutations() {
  const write = useWrite();
  return {
    create: (input: ObjectiveCreate) => write('/objectives', objective, z.json().parse(input)),
    patch: (id: string, input: ObjectivePatch) =>
      write(`/objectives/${id}`, objective, z.json().parse(input), 'PATCH'),
    remove: (id: string, revision: number) =>
      write(`/objectives/${id}`, opId, { revision }, 'DELETE'),
  };
}
