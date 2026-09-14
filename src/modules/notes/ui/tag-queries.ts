'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/core/http/client';
import { ManageTags, ManageTagsResult, TagList } from '../schema/validation';
export function useManagedTags() {
  return useQuery({ queryKey: ['notes', 'managed-tags'],
    queryFn: () => request('/admin/notes/tags', TagList) });
}
export function useManageTags() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ManageTags) => request('/admin/notes/tags', ManageTagsResult, { method: 'POST', body }),
    onSuccess: () => Promise.all(['notes', 'home', 'ai'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  });
}
