import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { settingsRegistry } from '@/core/config/settings';
import { aiConnection, checkConnection } from '../client';

const config = vi.hoisted(() => ({
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  SESSION_SECRET: 'a'.repeat(32),
  OPENROUTER_API_KEY: 'fixture-openrouter-key',
}));
vi.mock('@/core/config/env', async (original) => {
  const actual = await original<typeof import('@/core/config/env')>();
  return { ...actual, env: () => actual.parseEnvironment(config) };
});
vi.mock('@/core/db/ai-credentials-repo', () => ({ readAiCredentials: async () => undefined }));
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  config.OPENROUTER_API_KEY = 'fixture-openrouter-key';
  request.mockReset();
  vi.stubGlobal('fetch', request);
});
afterEach(() => vi.unstubAllGlobals());

it('ADMIN-B23 checks the OpenRouter key with bearer authentication and no Anthropic credential', async () => {
  request.mockResolvedValue(Response.json({ data: { limit_remaining: null } }));
  expect((await checkConnection()).state).toBe('enabled');
  const [input, init] = request.mock.calls[0] ?? [];
  const sent = new Request(input ?? 'https://example.test', init);
  expect(sent.url).toBe('https://openrouter.ai/api/v1/key');
  expect(sent.headers.get('authorization')).toBe('Bearer fixture-openrouter-key');
  expect(sent.headers.get('x-api-key')).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(aiConnection().checkedAt).not.toBeNull();
});
it('ADMIN-B23 disables AI when the selected provider key is missing without falling back', async () => {
  config.OPENROUTER_API_KEY = '';
  expect((await checkConnection()).state).toBe('disabled');
  expect(request).not.toHaveBeenCalled();
});
it('ADMIN-B23 maps provider failures without retrying or exposing response details', async () => {
  for (const [status, error] of [
    [401, 'invalid_key'],
    [402, 'billing'],
    [429, 'rate_limit'],
    [500, 'provider'],
  ] as const) {
    request.mockResolvedValue(Response.json({ error: 'private response' }, { status }));
    request.mockClear();
    expect(await checkConnection()).toMatchObject({ state: 'error', error });
    expect(request).toHaveBeenCalledTimes(1);
  }
});
it('ADMIN-B23 rejects malformed connection responses and exhausted key credit limits', async () => {
  request.mockResolvedValue(Response.json({ data: { limit_remaining: 0 } }));
  expect((await checkConnection()).error).toBe('billing');
  request.mockResolvedValue(Response.json({ unexpected: true }));
  expect((await checkConnection()).error).toBe('provider');
});
it('ADMIN-B23 maps a network failure to a safe connection error', async () => {
  request.mockRejectedValue(new TypeError('private network detail'));
  expect(await checkConnection()).toMatchObject({ state: 'error', error: 'network' });
});
it('ADMIN-B23 accepts namespaced OpenRouter model IDs and rejects unqualified model IDs', () => {
  const schema = settingsRegistry['ai.model.default'].schema;
  for (const value of [
    'anthropic/claude-sonnet-4.5',
    'openai/gpt-5',
    'vendor/model:free',
    '~anthropic/claude-sonnet-latest',
  ])
    expect(schema.safeParse(value).success).toBe(true);
  for (const value of [
    'gpt-5',
    'https://example.test/model',
    'vendor/',
    '/model',
    'vendor/model name',
  ])
    expect(schema.safeParse(value).success).toBe(false);
});
