import { it, expect, vi } from 'vitest';
import { createSaveQueue } from '../save-queue';
import { ApiError } from '@/core/http/client';
const entity = { id: 'sample', revision: 1, deletedAt: null, deletedOpId: null, title: 'Initial' };
it('EP-B08 TASKS-A09 queued fields survive conflict and explicit reapply uses latest revision and a new key', async () => {
  const writer = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('conflict', 'Conflict', {}, 'request'))
    .mockResolvedValue({ ...entity, revision: 3, title: 'Mine' });
  const queue = createSaveQueue<typeof entity, { title: string }>(writer, vi.fn());
  queue.save(entity, { title: 'Mine' });
  expect(await queue.settle()).toBe(false);
  await queue.retry(async () => ({ ...entity, revision: 2 }));
  expect(await queue.settle()).toBe(true);
  expect(writer.mock.calls.map((call) => call[1])).toEqual([1, 2]);
  expect(writer.mock.calls[0]?.[3]).not.toBe(writer.mock.calls[1]?.[3]);
  expect(writer.mock.calls[1]?.[2]).toEqual({ title: 'Mine' });
});
it('EP-B08 pending edits drain after the active save using its returned revision', async () => {
  let resolve: (value: typeof entity) => void = () => {
    throw new Error('Not initialized');
  };
  const writer = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<typeof entity>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ ...entity, revision: 3, title: 'Second' });
  const queue = createSaveQueue<typeof entity, { title: string }>(writer, vi.fn());
  queue.save(entity, { title: 'First' });
  queue.save(entity, { title: 'Second' });
  expect(writer).toHaveBeenCalledTimes(1);
  resolve({ ...entity, revision: 2, title: 'First' });
  expect(await queue.settle()).toBe(true);
  expect(writer.mock.calls.map((call) => call[1])).toEqual([1, 2]);
  expect(queue.latest()?.revision).toBe(3);
});
