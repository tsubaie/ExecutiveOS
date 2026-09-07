import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { User, UserPatch, UserCreate } from '../schema/validation';
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => request('/admin/users', z.object({ data: z.array(User) })),
  });
}
export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: z.infer<typeof UserPatch> }) =>
      request(`/admin/users/${id}`, z.object({ data: User }), { method: 'PATCH', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: z.infer<typeof UserCreate>) =>
      request(
        '/admin/users',
        z.object({ data: User, meta: z.object({ temporaryPassword: z.string() }) }),
        { method: 'POST', body: z.json().parse(input) },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useAdminResource(path: string) {
  return useQuery({
    queryKey: ['admin', path],
    queryFn: () => request(`/admin/${path}`, z.object({ data: z.json() })),
    refetchInterval: path === 'jobs' || path === 'backups' ? 2000 : 60000,
  });
}
export function useAdminAction(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request(`/admin/${path}`, z.object({ data: z.json() }), { method: 'POST', body: {} }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }),
  });
}
