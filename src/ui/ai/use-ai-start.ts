import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
const response = z.object({ data: z.object({ id: z.uuid() }) });
// Cancellation intent survives the interval between submitting and receiving the durable job ID.
export function useAiStart(path: string, revision: number, queryKey: string[], currentId?: string) {
  const client = useQueryClient();
  const intent = useRef(false);
  const accepted = useRef<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const cancel = useMutation({
    mutationFn: (jobId: string) => request('/ai/cancel', response, { method: 'POST', body: { jobId } }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
    onError: () => setWaiting(false),
  });
  const start = useMutation({
    onMutate: () => { intent.current = false; accepted.current = null; setWaiting(false); cancel.reset(); },
    mutationFn: () => request(path, response, { method: 'POST', body: { revision } }),
    onSuccess: async (result) => {
      accepted.current = result.data.id;
      if (intent.current) cancel.mutate(result.data.id);
      await client.invalidateQueries({ queryKey });
    },
    onError: () => setWaiting(false),
  });
  const requestCancel = () => {
    setWaiting(true);
    if (start.isPending) {
      intent.current = true;
      if (accepted.current) cancel.mutate(accepted.current);
    } else if (currentId) cancel.mutate(currentId);
  };
  return { start, cancel, waiting, requestCancel };
}
