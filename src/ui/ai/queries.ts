import { useAiStart } from './use-ai-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { AiAvailability, AiCapability } from '@/core/config/ai-capabilities';
import { AiJobView } from '@/core/config/ai-review-schema';
const applyResponse = z.object({ data: z.object({ ids: z.array(z.uuid()) }) });
// What the availability answer means for this one capability, kept out of the hook so the hook does
// not carry two more branches for it.
function availabilityOf(
  data: z.infer<typeof AiAvailability> | undefined,
  capability: z.infer<typeof AiCapability>,
) {
  return {
    enabled: data?.capabilities.includes(capability) ?? false,
    configured: data?.configured ?? false,
    canConfigure: data?.canConfigure ?? false,
  };
}
export function useAiReview(
  capability: z.infer<typeof AiCapability>,
  entityId: string,
  revision: number,
  path: string,
) {
  const client = useQueryClient();
  const availability = useQuery({
    queryKey: ['ai', 'availability'],
    queryFn: () => request('/ai/availability', z.object({ data: AiAvailability })),
    refetchInterval: 30000,
  });
  const job = useQuery({
    queryKey: ['ai', capability, entityId],
    queryFn: () =>
      request(
        `/ai/job?entityId=${entityId}&capability=${capability}`,
        z.object({ data: AiJobView.nullable() }),
      ),
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.data?.status ?? '') ? 1000 : 15000,
  });
  const refresh = () =>
    Promise.all(
      ['ai', 'tasks', 'notes', 'home', 'committees'].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  const current = job.data?.data ?? null;
  const { start, cancel, waiting, requestCancel } = useAiStart(path, revision, ['ai', capability, entityId], current?.id);
  const apply = useMutation({
    mutationFn: (body: z.infer<ReturnType<typeof z.json>>) =>
      request(`${path}/apply`, applyResponse, { method: 'POST', body }),
    onSuccess: refresh,
  });
  const discard = useMutation({
    mutationFn: () =>
      request(`${path}/discard`, applyResponse, {
        method: 'POST',
        body: { jobId: current?.id ?? '' },
      }),
    onSuccess: refresh,
  });
  return {
    capability,
    ...availabilityOf(availability.data?.data, capability),
    cancel,
    cancelling: waiting || persistedCancellation(current, start.isPending),
    requestCancel,
    checkingAvailability: availability.isFetching,
    recheckAvailability: () => availability.refetch(),
    job: current,
    progressStartedAt: start.isPending ? start.submittedAt : createdTime(current),
    pending: start.isPending || isPendingJob(current),
    stale: current !== null && current.revision !== revision,
    start,
    apply,
    discard,
    error: [start.error, apply.error, discard.error, job.error, availability.error].find(Boolean) ?? null,
  };
}
export type AiReview = ReturnType<typeof useAiReview>;

function persistedCancellation(job: z.infer<typeof AiJobView> | null, starting: boolean) {
  return !starting && Boolean(job?.cancelRequested);
}
function createdTime(job: z.infer<typeof AiJobView> | null) {
  return job ? Date.parse(job.createdAt) : null;
}

function isPendingJob(job: z.infer<typeof AiJobView> | null) {
  return job !== null && ['queued', 'running'].includes(job.status);
}
