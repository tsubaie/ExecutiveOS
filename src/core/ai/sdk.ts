import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { providerCredentials } from './credentials';
import { type Database } from '@/core/db/client';
import { openrouterEndpoint } from '@/core/config/ai';

export async function aiClient(timeout = 300_000, database?: Database) {
  const config = await providerCredentials(database);
  const key = config.apiKey;
  if (!key) return null;
  return new Anthropic({
    baseURL: openrouterEndpoint,
    apiKey: null,
    authToken: key,
    maxRetries: 0,
    timeout,
  });
}
