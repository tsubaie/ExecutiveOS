import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Setting, SettingWrite } from '../schema/validation';
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => request('/admin/settings', z.object({ data: z.array(Setting) })),
  });
}
export function useSaveSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: z.infer<typeof SettingWrite>) =>
      request('/admin/settings', z.object({ data: Setting }), { method: 'PATCH', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['settings'] }),
  });
}
