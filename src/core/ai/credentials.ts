import 'server-only';
import { env } from '@/core/config/env';
import { AiProvider, AiCredentialWrite, AiCredentialStatus } from '@/core/config/ai-schema';
import { db, type Database } from '@/core/db/client';
import {
  readAiCredentials,
  saveAiCredentials,
  deleteAiCredentials,
} from '@/core/db/ai-credentials-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { encryptKey, decryptKey } from './secret';

export async function credentialStatus(database: Database = db()) {
  const saved = await readAiCredentials(database);
  if (saved) return AiCredentialStatus.parse({ provider: saved.provider, source: 'saved' });
  return AiCredentialStatus.parse({
    provider: 'openrouter',
    source: env().OPENROUTER_API_KEY ? 'environment' : 'none',
  });
}
export async function providerCredentials(database: Database = db()) {
  const saved = await readAiCredentials(database);
  if (saved)
    return {
      provider: AiProvider.parse(saved.provider),
      apiKey: decryptKey(saved.encryptedKey, saved.provider),
    };
  return { provider: AiProvider.value, apiKey: env().OPENROUTER_API_KEY };
}
export async function saveCredentials(database: Database, actor: string, input: unknown) {
  const value = AiCredentialWrite.parse(input);
  await saveAiCredentials(database, AiProvider.value, encryptKey(value.apiKey, AiProvider.value));
  await writeAudit(database, actor, 'ai.credentials.save', 'ai_credentials', null, {
    provider: AiProvider.value,
  });
  return credentialStatus(database);
}
export async function removeCredentials(database: Database, actor: string) {
  await deleteAiCredentials(database);
  await writeAudit(database, actor, 'ai.credentials.remove', 'ai_credentials', null, {});
  return credentialStatus(database);
}
