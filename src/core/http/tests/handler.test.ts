import { beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineHandler } from '../handler';
import { AppError } from '../errors';
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock('@/core/auth/session', () => session);
vi.mock('@/core/backup/maintenance', () => ({ isRestoring: async () => false }));
vi.mock('@/core/db/http-repo', () => ({
  maintenance: async () => false,
  lockRequest: vi.fn(),
  replayRequest: vi.fn(),
  storeRequest: vi.fn(),
}));
vi.mock('@/core/db/client', () => ({
  db: () => ({ transaction: (work: (database: object) => Promise<object>) => work({}) }),
}));
vi.mock('../origin', () => ({ checkOrigin: () => {} }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/core/config/logger', () => ({ logger: { error: vi.fn() } }));
beforeEach(() => session.currentUser.mockReset().mockResolvedValue(null));
const request = () =>
  new Request('http://localhost/api/v1/example', { method: 'POST', body: '{}' });
it('ADMIN-B37 a full queue answers 429 rate_limited with the queue scope and a Retry-After header', async () => {
  const route = defineHandler({
    guard: 'public',
    input: z.strictObject({}),
    response: z.object({}),
    enqueues: true,
    handler: async () => {
      throw new AppError('rate_limited', {
        scope: 'queue',
        kind: 'system.backup',
        retryAfterSeconds: 30,
      });
    },
  });
  const response = await route(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('30');
  expect(await response.json()).toMatchObject({
    error: { code: 'rate_limited', details: { scope: 'queue', retryAfterSeconds: 30 } },
  });
  expect(route.meta.enqueues).toBe(true);
});
it('ADMIN-B37 an unexpected error stays a 500 without Retry-After', async () => {
  const route = defineHandler({
    guard: 'public',
    input: z.strictObject({}),
    response: z.object({}),
    handler: async () => {
      throw new Error('boom');
    },
  });
  const response = await route(request());
  expect(response.status).toBe(500);
  expect(response.headers.get('Retry-After')).toBeNull();
  expect(route.meta.enqueues).toBe(false);
});
it('ACCT-B09 API requests are the ones that slide the session', async () => {
  const route = defineHandler({
    guard: 'public',
    input: z.strictObject({}),
    response: z.object({}),
    handler: async () => ({}),
  });
  expect((await route(request())).status).toBe(200);
  expect(session.currentUser).toHaveBeenCalledWith({ slide: true });
});
