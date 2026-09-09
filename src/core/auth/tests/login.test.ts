import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { insertUser, lockWorkspace } from '@/core/db/auth-repo';
import { id } from '@/core/db/ids';
import { env } from '@/core/config/env';
// The recovery route exists only when RECOVERY_TOKEN is configured; the suite reads the value the
// test environment was given rather than setting one, because env.ts owns environment access.
const recoveryToken = env().RECOVERY_TOKEN ?? '';
// The placeholder verification (ADMIN-B21) is observable only as a call, so the real helper is
// wrapped rather than replaced: the argon2 cost and the hash it receives both stay assertable.
const { verified } = vi.hoisted(() => ({ verified: [] as string[] }));
vi.mock('../password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../password')>();
  return {
    ...actual,
    verifyPassword: (hash: string, value: string) => {
      verified.push(hash);
      return actual.verifyPassword(hash, value);
    },
  };
});
const { login, recover } = await import('../login');
const { hashPassword } = await import('../password');
const password = 'correct-horse-battery-staple';
let passwordHash = '';
async function addUser(email: string, isActive = true) {
  return db().transaction(async (database) => {
    await lockWorkspace(database);
    return insertUser(database, {
      id: id(),
      name: email,
      email,
      passwordHash,
      role: 'admin',
      isActive,
    });
  });
}
const fail = (email: string, ip: string | null) =>
  expect(login({ email, password: 'wrong-password' }, ip)).rejects.toMatchObject({
    code: 'unauthenticated',
  });
beforeAll(async () => {
  await migrateDatabase();
  passwordHash = await hashPassword(password);
});
beforeEach(async () => {
  verified.length = 0;
  await db().execute(
    sql`truncate users, sessions, login_attempts, recovery_token_uses, settings, audit_log cascade`,
  );
});
afterAll(() => pool().end());

it('ADMIN-B20 an unresolved client address never shares one throttling bucket across accounts', async () => {
  await addUser('locked@example.test');
  await addUser('bystander@example.test');
  for (let attempt = 0; attempt < 5; attempt++) await fail('locked@example.test', null);
  await expect(
    login({ email: 'locked@example.test', password }, null),
  ).rejects.toMatchObject({ code: 'rate_limited', details: { scope: 'login' } });
  // Without a trusted proxy the address is unknown, so it must not become a shared bucket that
  // five failures anywhere can exhaust for the whole installation.
  const session = await login({ email: 'bystander@example.test', password }, null);
  expect(session.user.email).toBe('bystander@example.test');
});

it('ADMIN-B20 per-email and per-address failures are counted as independent buckets', async () => {
  await addUser('target@example.test');
  for (let attempt = 0; attempt < 3; attempt++) await fail('target@example.test', '10.0.0.1');
  for (let attempt = 0; attempt < 2; attempt++) await fail('other@example.test', '203.0.113.9');
  // Three failures on the email and two on the address are each under the threshold; only their
  // union reaches five, and a union is not a limit anybody configured.
  const session = await login({ email: 'target@example.test', password }, '203.0.113.9');
  expect(session.user.email).toBe('target@example.test');
});

it('ADMIN-B20 five failures from one address throttle that address independently of the email', async () => {
  await addUser('first@example.test');
  await addUser('second@example.test');
  for (let attempt = 0; attempt < 5; attempt++) await fail(`spray${attempt}@example.test`, '203.0.113.9');
  await expect(
    login({ email: 'first@example.test', password }, '203.0.113.9'),
  ).rejects.toMatchObject({ code: 'rate_limited', details: { scope: 'login' } });
  const session = await login({ email: 'second@example.test', password }, '198.51.100.4');
  expect(session.user.email).toBe('second@example.test');
});

it('ADMIN-B21 every login path performs one argon2 verification whatever the account state', async () => {
  await addUser('active@example.test');
  await addUser('inactive@example.test', false);
  await fail('unknown@example.test', '203.0.113.9');
  expect(verified).toHaveLength(1);
  // Identical cost parameters are the point: a cheaper placeholder would restore the timing gap.
  expect(verified[0]).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/u);
  expect(verified[0]).not.toBe(passwordHash);
  await fail('inactive@example.test', '203.0.113.10');
  expect(verified).toHaveLength(2);
  expect(verified[1]).not.toBe(passwordHash);
  await fail('active@example.test', '203.0.113.11');
  expect(verified).toHaveLength(3);
  expect(verified[2]).toBe(passwordHash);
});

it('ADMIN-B22 recovery attempts are throttled by client address and stay single-use', async () => {
  const admin = await addUser('admin@example.test');
  const attempt = (token: string, ip: string | null) =>
    recover({ email: admin.email, password: 'a-brand-new-password-1', token }, ip);
  for (let index = 0; index < 5; index++)
    await expect(attempt('wrong-token', '203.0.113.9')).rejects.toMatchObject({ code: 'forbidden' });
  await expect(attempt(recoveryToken, '203.0.113.9')).rejects.toMatchObject({
    code: 'rate_limited',
    details: { scope: 'login' },
  });
  await expect(attempt(recoveryToken, '198.51.100.4')).resolves.toBeUndefined();
  await expect(attempt(recoveryToken, '198.51.100.4')).rejects.toMatchObject({ code: 'conflict' });
});
