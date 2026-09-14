import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { readAiCredentials } from '@/core/db/ai-credentials-repo';
import { auditEntries } from '@/core/db/admin-repo';
import { id } from '@/core/db/ids';
import {
  credentialStatus,
  providerCredentials,
  saveCredentials,
  removeCredentials,
} from '../credentials';
import { encryptKey, decryptKey } from '../secret';
import { redact } from '@/core/config/redact';

beforeAll(() => migrateDatabase());
beforeEach(() => db().execute(sql`truncate ai_credentials, audit_log`));
afterAll(() => pool().end());
it('ADMIN-B24 saves encrypted credentials persistently and exposes only safe metadata', async () => {
  const actor = id();
  const input = { provider: 'openrouter', apiKey: 'fixture-private-key' };
  const result = await db().transaction((tx) =>
    saveCredentials(tx, actor, { apiKey: input.apiKey }),
  );
  expect(result).toEqual({ provider: 'openrouter', source: 'saved' });
  const stored = await readAiCredentials(db());
  expect(stored?.encryptedKey).not.toContain(input.apiKey);
  expect(await providerCredentials()).toEqual(input);
  expect(await credentialStatus()).toEqual(result);
  expect(JSON.stringify(await auditEntries(db()))).not.toContain(input.apiKey);
  await db().transaction((tx) => saveCredentials(tx, actor, { apiKey: 'replacement-key' }));
  expect(await providerCredentials()).toEqual({
    provider: 'openrouter',
    apiKey: 'replacement-key',
  });
  await db().transaction((tx) => removeCredentials(tx, actor));
  expect(await readAiCredentials(db())).toBeUndefined();
  expect((await credentialStatus()).source).not.toBe('saved');
});
it('ADMIN-B24 rejects empty credentials and authenticated encryption detects tampering', async () => {
  await expect(saveCredentials(db(), id(), { apiKey: ' ' })).rejects.toThrow();
  const first = encryptKey('fixture-private-key', 'openrouter');
  expect(encryptKey('fixture-private-key', 'openrouter')).not.toBe(first);
  expect(decryptKey(first, 'openrouter')).toBe('fixture-private-key');
  expect(() => decryptKey(first, 'anthropic')).toThrow();
  expect(() => decryptKey(first.replace('v1.', 'v2.'), 'openrouter')).toThrow();
  expect(redact({ OPENROUTER_API_KEY: 'private', encryptedKey: first, apiKey: 'private' })).toEqual(
    {
      OPENROUTER_API_KEY: '[redacted]',
      encryptedKey: '[redacted]',
      apiKey: '[redacted]',
    },
  );
});
