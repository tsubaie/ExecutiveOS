import { AiControls, AiControlsWrite } from '@/core/config/ai-controls-schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AiCredentialStatus, AiCredentialWrite } from '@/core/config/ai-schema';
import { AiModels, AiModelSelection } from '@/core/config/ai-model-schema';
import { request } from '@/core/http/client';
const response = z.object({ data: AiCredentialStatus });
export function useAiCredentials() {
  return useQuery({
    queryKey: ['admin', 'ai', 'credentials'],
    refetchOnWindowFocus: false,
    queryFn: () => request('/admin/ai/credentials', response),
  });
}
export function useSaveAiCredentials() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: z.infer<typeof AiCredentialWrite>) =>
      request('/admin/ai/credentials', response, { method: 'PUT', body: input }),
    gcTime: 0,
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'ai'] }),
  });
}
export function useRemoveAiCredentials() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request('/admin/ai/credentials', response, { method: 'DELETE', body: {} }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'ai'] }),
  });
}
export function useAiModels(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'ai', 'models'],
    enabled,
    queryFn: () => request('/admin/ai/models', z.object({ data: AiModels })),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
export function useSaveAiModels() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: z.infer<typeof AiModelSelection>) =>
      request('/admin/ai/models', z.object({ data: AiModels }), { method: 'PUT', body: input }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['admin', 'ai'] }), client.invalidateQueries({ queryKey: ['ai'] })]),
  });
}
export function useAiControls() {
  return useQuery({ queryKey: ['admin', 'ai', 'controls'], queryFn: () => request('/admin/ai/controls', z.object({ data: AiControls })), refetchInterval: 30000 });
}
export function useSaveAiControls() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: z.infer<typeof AiControlsWrite>) => request('/admin/ai/controls', z.object({ data: AiControls }), { method: 'PUT', body: input }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['admin', 'ai'] }), client.invalidateQueries({ queryKey: ['ai'] })]) });
}
