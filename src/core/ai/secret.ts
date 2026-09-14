import 'server-only';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '@/core/config/env';
import { AppError } from '@/core/http/errors';
function encryptionKey() {
  return Buffer.from(
    hkdfSync('sha256', env().SESSION_SECRET, 'ExecutiveOS', 'ai-credentials-v1', 32),
  );
}
export function encryptKey(apiKey: string, provider: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(provider));
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return [
    'v1',
    nonce.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}
export function decryptKey(value: string, provider: string) {
  try {
    const [version, nonce, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !nonce || !tag || !encrypted) throw new Error('Invalid envelope');
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(nonce, 'base64'));
    cipher.setAAD(Buffer.from(provider));
    cipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      cipher.update(Buffer.from(encrypted, 'base64')),
      cipher.final(),
    ]).toString('utf8');
  } catch {
    throw new AppError('ai_unavailable', { reason: 'credentials' });
  }
}
