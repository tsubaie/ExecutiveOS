import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { env } from '@/core/config/env';
import { User } from '@/core/http/user-schema';
import { read, save, remove } from '@/core/http/ai-credentials-api';
import { id } from '@/core/db/ids';
const session = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('@/core/auth/session', () => ({
  currentUser: async () =>
    User.parse({
      id: id(),
      role: session.role,
      email: 'admin@example.test',
      name: 'Admin',
      isActive: true,
      revision: 1,
    }),
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
beforeAll(() => migrateDatabase());
beforeEach(async () => {
  session.role = 'admin';
  await db().execute(sql`truncate ai_credentials`);
});
afterAll(() => pool().end());
function request(method: string, origin = env().APP_URL) {
  return new Request(new URL('/api/v1/admin/ai/credentials', env().APP_URL), {
    method,
    headers: { Origin: origin, 'X-Requested-With': 'ExecutiveOS' },
    ...(method === 'PUT' ? { body: JSON.stringify({ apiKey: 'fixture-api-key' }) } : {}),
  });
}
it('ADMIN-B24 members cannot read, save, or remove credentials and cross-origin writes fail', async () => {
  session.role = 'member';
  expect((await read(request('GET'))).status).toBe(403);
  expect((await save(request('PUT'))).status).toBe(403);
  expect((await remove(request('DELETE'))).status).toBe(403);
  session.role = 'admin';
  expect((await save(request('PUT', 'https://untrusted.example.test'))).status).toBe(403);
});
it('ADMIN-B24 admin API saves and removes credentials without returning secrets', async () => {
  const saved = await save(request('PUT'));
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ data: { provider: 'openrouter', source: 'saved' } });
  const readBack = await read(request('GET'));
  expect(await readBack.json()).toEqual({ data: { provider: 'openrouter', source: 'saved' } });
  expect((await remove(request('DELETE'))).status).toBe(200);
});
