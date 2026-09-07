import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser } from '@/core/db/auth-repo';
import { countQueries } from '@/core/db/query-log';
import { id } from '@/core/db/ids';
import { User } from '@/core/http/user-schema';
import { homeProviders, mergeJobs, serverModules } from '../registry';
import { House } from 'lucide-react';
import { navigationFor } from '../client';
import { registry, jobKinds } from '@/core/jobs/registry';
import type { JobHandler } from '@/core/jobs/types';
let user: User;
beforeAll(async () => {
  await migrateDatabase();
});
beforeEach(async () => {
  await db().execute(sql`truncate tasks, people, users, settings, audit_log cascade`);
  user = User.parse(
    await insertUser(db(), {
      id: id(),
      name: 'R',
      email: 'r@example.test',
      passwordHash: 'x',
      role: 'admin',
    }),
  );
});
afterAll(() => pool().end());
const noop: JobHandler = {
  concurrency: 1,
  schema: {} as never,
  run: async () => null,
  publish: async () => {},
};
describe('module registry', () => {
  it('HOME-B03 every home provider answers within two queries', async () => {
    for (const provide of homeProviders()) {
      const { queries, result } = await countQueries(() =>
        db().transaction((tx) => provide({ db: tx, user, requestId: id() })),
      );
      expect(queries).toBeLessThanOrEqual(2);
      expect(result.every((section) => section.href === null || section.href.startsWith('/'))).toBe(
        true,
      );
    }
    expect(serverModules.map((item) => item.id)).toEqual(['tasks', 'people', 'users', 'settings']);
  });
  it('ADMIN-B15 the job registry has the system kinds and refuses a kind registered twice', () => {
    expect(jobKinds).toEqual(
      expect.arrayContaining(['system.noop', 'system.prune', 'system.backup']),
    );
    expect(new Set(jobKinds).size).toBe(jobKinds.length);
    expect(
      Object.keys(mergeJobs({ 'system.noop': noop }, [{ id: 'm', jobs: { 'm.work': noop } }])),
    ).toEqual(['system.noop', 'm.work']);
    expect(() =>
      mergeJobs({ 'system.noop': noop }, [{ id: 'm', jobs: { 'system.noop': noop } }]),
    ).toThrow(/twice/u);
    expect(registry['system.backup']?.concurrency).toBe(1);
  });
  it('EP-A01 navigation comes from manifests, sorted, with admin entries hidden from members', () => {
    const nav = navigationFor(
      [
        { id: 'b', nav: { href: '/b', key: 'people', icon: House, admin: false, order: 20 } },
        { id: 'a', nav: { href: '/a', key: 'home', icon: House, admin: false, order: 10 } },
        { id: 'z', nav: { href: '/z', key: 'admin', icon: House, admin: true, order: 90 } },
        { id: 'silent' },
      ],
      'member',
    );
    expect(nav.map((entry) => entry.href)).toEqual(['/a', '/b']);
    expect(
      navigationFor(
        [{ id: 'z', nav: { href: '/z', key: 'admin', icon: House, admin: true, order: 1 } }],
        'admin',
      ),
    ).toHaveLength(1);
  });
});
