'use client';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import {
  TaskDetail,
  TaskList,
  Completed,
  type TaskCreate,
  type TaskPatch,
} from '../schema/validation';
import { PersonList } from '@/modules/people/schema/validation';
import type { Filters } from '@/ui/entity/types';
import { listResult } from '@/ui/entity/queries';
const response = z.object({ data: TaskDetail });
export function useTasks(filters: Filters) {
  const query = useInfiniteQuery({
    queryKey: ['tasks', 'list', filters],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request(
        `/tasks?${new URLSearchParams(Object.fromEntries(Object.entries({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }).filter(([, value]) => value !== '')))}`,
        TaskList,
      ),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });
  return { ...listResult(query), defaultView: query.data?.pages[0]?.meta.defaultView };
}
// TASKS-B17: the shell badge needs the view counts, not the rows, so it asks for one row and
// reads `meta.counts`. It shares the documented counts key, so any task mutation refreshes it.
export function useTaskCount() {
  const query = useQuery({
    queryKey: ['tasks', 'counts', {}],
    queryFn: () => request('/tasks?view=all&limit=1', TaskList),
    refetchInterval: 60000,
  });
  return query.data?.meta.counts.all ?? null;
}
export function useTask(id: string | null, trash: boolean) {
  const query = useQuery({
    queryKey: ['tasks', 'detail', id, trash],
    enabled: Boolean(id),
    queryFn: () => request(`/tasks/${id}?includeDeleted=${trash}`, response),
  });
  return {
    data: query.data?.data,
    pending: query.isLoading,
    error: query.error,
    refetch: async () => (await query.refetch()).data?.data,
  };
}
export function useOwners() {
  return useQuery({
    queryKey: ['people', 'assignable'],
    queryFn: () => request('/people?view=assignable&limit=200', PersonList),
  });
}
export function useTaskMutations() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all(
      ['tasks', 'people', 'home', 'notes', 'committees'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  async function write(
    path: string,
    body: z.infer<ReturnType<typeof z.json>>,
    method = 'POST',
    key?: string,
  ) {
    try {
      return (await request(path, response, { method, body, ...(key ? { key } : {}) })).data;
    } finally {
      await refresh();
    }
  }
  return {
    patch: (id: string, revision: number, patch: Omit<TaskPatch, 'revision'>, key: string) =>
      write(`/tasks/${id}`, z.json().parse({ ...patch, revision }), 'PATCH', key),
    create: (input: TaskCreate) => write('/tasks', input),
    // The caller reports the deletion the moment the server has taken it: the row is already gone
    // from the screen, and a receipt that arrives once five query trees have refetched arrives
    // after the reader has stopped looking for it. The invalidation still runs, it just no longer
    // stands between the delete and the word about it.
    remove: async (id: string, revision: number) => {
      try {
        return await request(`/tasks/${id}`, z.object({ opId: z.string() }), {
          method: 'DELETE',
          body: { revision },
        });
      } finally {
        void refresh();
      }
    },
    restore: (id: string, opId: string) => write(`/tasks/${id}/restore`, { opId }),
    action: (id: string, action: string, body: z.infer<ReturnType<typeof z.json>>) =>
      write(`/tasks/${id}/${action}`, body),
    // TASKS-B02: completing hands back the operation the toast's Undo will address, so the caller
    // keeps the envelope rather than the task alone.
    complete: async (id: string, revision: number, force: boolean) => {
      try {
        return await request(`/tasks/${id}/complete`, Completed, {
          method: 'POST',
          body: { revision, force },
        });
      } finally {
        void refresh();
      }
    },
    undoComplete: (id: string, opId: string) => write(`/tasks/${id}/complete/undo`, { opId }),
    group: (title: string, childIds: string[]) => write('/tasks/group', { title, childIds }),
    reorder: (parentId: string, orderedIds: string[], revisions: Record<string, number>) =>
      write('/tasks/reorder', { parentId, orderedIds, revisions }, 'PATCH'),
  };
}
