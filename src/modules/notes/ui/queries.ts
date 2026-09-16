'use client';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { PersonList, PersonCreated, personDraft } from '@/modules/people/schema/validation';
import type { Filters } from '@/ui/entity/types';
import { listResult } from '@/ui/entity/queries';
import {
  NoteDetail,
  NoteList,
  NoteTypes,
  TagList,
  BulkResult,
  type NoteCreate,
  type NotePatch,
} from '../schema/validation';
const response = z.object({ data: NoteDetail });
type Json = z.infer<ReturnType<typeof z.json>>;
const query = (filters: Record<string, string>) =>
  new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''));
export function useNotes(filters: Filters) {
  const list = useInfiniteQuery({
    queryKey: ['notes', 'list', filters],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request(`/notes?${query({ ...filters, cursor: pageParam })}`, NoteList),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  return listResult(list);
}
export function useNote(id: string | null, trash: boolean) {
  const detail = useQuery({
    queryKey: ['notes', 'detail', id, trash],
    enabled: Boolean(id),
    queryFn: () => request(`/notes/${id}?includeDeleted=${trash}`, response),
  });
  return {
    data: detail.data?.data,
    pending: detail.isLoading,
    error: detail.error,
    refetch: async () => (await detail.refetch()).data?.data,
  };
}
export function useNoteTypes() {
  return useQuery({
    queryKey: ['notes', 'types'],
    queryFn: () => request('/notes/types', NoteTypes),
  });
}
export function useTags() {
  return useQuery({ queryKey: ['notes', 'tags'], queryFn: () => request('/notes/tags', TagList) });
}
export function useAllPeople() {
  return useQuery({
    queryKey: ['people', 'all'],
    queryFn: () => request('/people?view=all&limit=200', PersonList),
  });
}
export function useNoteMutations() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all(
      ['notes', 'people', 'home', 'tasks', 'committees'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  async function write<S extends z.ZodType>(
    path: string,
    schema: S,
    body: Json,
    method = 'POST',
    key?: string,
  ) {
    try {
      return await request(path, schema, { method, body, ...(key ? { key } : {}) });
    } finally {
      await refresh();
    }
  }
  const one = async (path: string, body: Json, method = 'POST', key?: string) =>
    (await write(path, response, body, method, key)).data;
  return {
    patch: (id: string, revision: number, patch: Omit<NotePatch, 'revision'>, key: string) =>
      one(`/notes/${id}`, z.json().parse({ ...patch, revision }), 'PATCH', key),
    create: (input: NoteCreate) => one('/notes', input),
    // The delete reports itself the moment the server has taken it. Awaiting the invalidation here
    // put every dependent query's refetch between the press and the panel closing, so the record
    // sat on screen for a second after it was gone. The refresh still runs, just not in the way.
    remove: async (id: string, revision: number) => {
      try {
        return await request(`/notes/${id}`, z.object({ opId: z.string() }), {
          method: 'DELETE',
          body: { revision },
        });
      } finally {
        void refresh();
      }
    },
    restore: (id: string, opId: string) => one(`/notes/${id}/restore`, { opId }),
    archive: (id: string, revision: number, archived: boolean) =>
      one(`/notes/${id}/${archived ? 'archive' : 'unarchive'}`, { revision }),
    bulkArchive: (items: { id: string; revision: number }[]) =>
      write('/notes/bulk/archive', BulkResult, { items }),
    bulkTag: (items: { id: string; revision: number }[], tag: string) =>
      write('/notes/bulk/tag', BulkResult, { items, tag }),
    // NOTES-B08: quick-create makes an external, non-assignable person from a name.
    createPerson: async (fullName: string) => {
      const created = await write('/people', PersonCreated, personDraft(fullName));
      return created.data;
    },
  };
}
