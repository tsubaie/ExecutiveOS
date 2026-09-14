import { beforeEach, expect, it, vi } from 'vitest';
import { type Context } from '@/core/auth/session';
import { cancelAi } from '../cancel';
const repo = vi.hoisted(() => ({ read: vi.fn(), cancel: vi.fn(), audit: vi.fn() }));
vi.mock('@/core/db/ai-jobs-repo', () => ({ lockedAiJob: repo.read, requestAiCancellation: repo.cancel }));
vi.mock('@/core/db/audit-repo', () => ({ writeAudit: repo.audit }));
beforeEach(() => vi.clearAllMocks());
// The service needs only the actor role/id and transaction handle; repositories are mocked.
const member = { db: {}, user: { id: 'actor', role: 'member' } } as Context;
it('NOTES-B19 requests cancellation for the creator without changing entity data', async () => {
  const job = { id: 'job', createdBy: 'actor', kind: 'ai.notes.refine', status: 'running', cancelRequested: false };
  repo.read.mockResolvedValue(job);
  expect(await cancelAi(member, 'job')).toEqual({ id: 'job' });
  expect(repo.cancel).toHaveBeenCalledWith(member.db, job);
  expect(repo.audit).toHaveBeenCalledTimes(1);
});
it('NOTES-B19 denies cancellation of another user job or a non-AI job', async () => {
  for (const job of [
    { createdBy: 'other', kind: 'ai.notes.refine' },
    { createdBy: 'actor', kind: 'backup.create' },
  ]) {
    repo.read.mockResolvedValue(job);
    await expect(cancelAi(member, 'job')).rejects.toMatchObject({ code: 'not_found' });
  }
  expect(repo.cancel).not.toHaveBeenCalled();
});
it('NOTES-B19 repeated cancellation and already finished jobs do not discard results', async () => {
  for (const status of ['cancelled', 'succeeded', 'failed']) {
    repo.read.mockResolvedValue({ id: 'job', createdBy: 'actor', kind: 'ai.notes.refine', status });
    expect(await cancelAi(member, 'job')).toEqual({ id: 'job' });
  }
  expect(repo.cancel).not.toHaveBeenCalled();
});
