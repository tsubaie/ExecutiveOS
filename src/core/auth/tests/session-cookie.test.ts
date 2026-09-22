import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '../session';
const jar = vi.hoisted(() => ({ value: 'raw-token' as string | undefined, set: vi.fn() }));
const repo = vi.hoisted(() => ({ sessionByHash: vi.fn(), refreshSession: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (jar.value === undefined ? undefined : { value: jar.value }),
    set: jar.set,
  }),
}));
vi.mock('@/core/db/auth-repo', () => ({ ...repo, insertSession: vi.fn() }));
vi.mock('@/core/config/env', () => ({ secureCookies: () => true }));
const day = 86400000;
const now = new Date('2026-09-22T12:00:00Z').getTime();
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Reader',
  email: 'reader@example.test',
  role: 'member',
  isActive: true,
  locale: null,
  timezone: null,
  revision: 1,
};
function session(lastSeenMsAgo: number, absoluteInDays: number) {
  return {
    session: {
      id: 'session-1',
      lastSeenAt: new Date(now - lastSeenMsAgo),
      absoluteExpiresAt: new Date(now + absoluteInDays * day),
    },
    user,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  jar.value = 'raw-token';
  jar.set.mockReset();
  repo.refreshSession.mockReset();
});
describe('sliding session cookie', () => {
  it('ACCT-B09 an API request that extends the session re-issues the cookie for the same lifetime', async () => {
    repo.sessionByHash.mockResolvedValue(session(5 * 60000, 80));
    await currentUser({ slide: true });
    const expiry = new Date(now + 30 * day);
    expect(repo.refreshSession).toHaveBeenCalledWith('session-1', expiry);
    expect(jar.set).toHaveBeenCalledWith(
      'eos_session',
      'raw-token',
      expect.objectContaining({ maxAge: 30 * 86400, httpOnly: true, secure: true }),
    );
  });
  it('ACCT-B09 the cookie never outlives the absolute expiry', async () => {
    repo.sessionByHash.mockResolvedValue(session(5 * 60000, 3));
    await currentUser({ slide: true });
    expect(repo.refreshSession).toHaveBeenCalledWith('session-1', new Date(now + 3 * day));
    expect(jar.set.mock.calls[0]?.[2]).toMatchObject({ maxAge: 3 * 86400 });
  });
  it('ACCT-B09 page renders and recently seen sessions change neither the row nor the cookie', async () => {
    repo.sessionByHash.mockResolvedValue(session(5 * 60000, 80));
    expect(await currentUser()).toMatchObject({ id: user.id });
    repo.sessionByHash.mockResolvedValue(session(10000, 80));
    await currentUser({ slide: true });
    expect(repo.refreshSession).not.toHaveBeenCalled();
    expect(jar.set).not.toHaveBeenCalled();
  });
});
