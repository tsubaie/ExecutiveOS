import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { NotificationFeed } from '../schema/validation';
export const feedKey = ['notifications', 'list'];
// NOTIF-B11: the same cadence every list uses (05) — on focus and every sixty seconds while
// visible. There is no socket and no push; the centre is read when the reader opens it.
export function useNotifications() {
  return useQuery({
    queryKey: feedKey,
    queryFn: () => request('/notifications', NotificationFeed),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
function useFeedMutation<I, O>(send: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSettled: () => client.invalidateQueries({ queryKey: feedKey }),
  });
}
export function useMarkRead() {
  return useFeedMutation((id: string) =>
    request(`/notifications/${id}/read`, z.object({ data: z.object({ id: z.uuid() }) }), {
      method: 'POST',
      body: {},
    }),
  );
}
export function useMarkAllRead() {
  return useFeedMutation(() =>
    request('/notifications/read-all', z.object({ data: z.object({ marked: z.number() }) }), {
      method: 'POST',
      body: {},
    }),
  );
}
