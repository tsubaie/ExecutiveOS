import 'server-only';
import { env } from '@/core/config/env';
import { logger } from '@/core/config/logger';
import { id } from '@/core/db/ids';
import { claim, renew, publish, fail, type Claimed } from '@/core/db/jobs-repo';
import { registry } from './registry';
import { JobKind } from './types';
import { scheduleDue } from './scheduler';
function startHeartbeat(job: Claimed, controller: AbortController) {
  return setInterval(() => {
    void renew(job).then(
      (ok) => {
        if (!ok) controller.abort();
      },
      (error) => {
        controller.abort();
        logger.error({ err: error, jobId: job.id }, 'Lease renewal failed');
      },
    );
  }, 30000);
}
async function runJob(job: Claimed, active: Map<string, AbortController>) {
  const controller = new AbortController();
  active.set(job.id, controller);
  const handler = registry[JobKind.parse(job.kind)];
  const heartbeat = startHeartbeat(job, controller);
  try {
    handler.schema.parse(job.payload);
    const result = await handler.run(job, controller.signal);
    controller.signal.throwIfAborted();
    await publish(job, result, handler.publish);
  } catch (error) {
    await fail(job, error instanceof Error ? error.message : 'job_failed');
  } finally {
    clearInterval(heartbeat);
    active.delete(job.id);
  }
}
export function startRunner() {
  const owner = id();
  const active = new Map<string, AbortController>();
  let stopped = false;
  let busy = false;
  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try {
      for (const kind of JobKind.options) {
        const job = await claim(owner, kind, registry[kind].concurrency, env().JOBS_CONCURRENCY);
        if (job)
          void runJob(job, active).catch((error) =>
            logger.error({ err: error, jobId: job.id }, 'Job failed'),
          );
      }
    } catch (error) {
      logger.error({ err: error }, 'Runner tick failed');
    } finally {
      busy = false;
    }
  }
  const interval = setInterval(() => void tick(), 1000);
  const scheduler = setInterval(
    () => void scheduleDue().catch((error) => logger.error({ err: error }, 'Scheduler failed')),
    60000,
  );
  void scheduleDue().catch((error) => logger.error({ err: error }, 'Scheduler startup failed'));
  return () => {
    stopped = true;
    clearInterval(interval);
    clearInterval(scheduler);
    for (const controller of active.values()) controller.abort();
  };
}
