import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/core/config/env';
type Connection = {
  state: 'disabled' | 'enabled' | 'error';
  checkedAt: string | null;
  error: string | null;
};
let connection: Connection = { state: 'disabled', checkedAt: null, error: null };
export function aiConnection() {
  return connection;
}
export async function checkConnection() {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) {
    connection = { state: 'disabled', checkedAt: new Date().toISOString(), error: null };
    return connection;
  }
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 10000 });
    await client.models.list();
    connection = { state: 'enabled', checkedAt: new Date().toISOString(), error: null };
  } catch (error) {
    connection = {
      state: 'error',
      checkedAt: new Date().toISOString(),
      error:
        error instanceof Anthropic.AuthenticationError
          ? 'invalid_key'
          : error instanceof Anthropic.RateLimitError
            ? 'rate_limit'
            : error instanceof Anthropic.APIConnectionError
              ? 'network'
              : 'provider',
    };
  }
  return connection;
}
