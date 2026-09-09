import 'server-only';
import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '@/core/http/errors';
let active = 0;
async function admitted<T>(work: () => Promise<T>) {
  if (active >= 2) throw new AppError('rate_limited', { retryAfterSeconds: 2, scope: 'login' });
  active++;
  try {
    return await work();
  } finally {
    active--;
  }
}
export function hashPassword(value: string) {
  return admitted(() =>
    argon2.hash(value, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }),
  );
}
export function verifyPassword(hash: string, value: string) {
  return admitted(() => argon2.verify(hash, value));
}
export function token() {
  return randomBytes(32).toString('hex');
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function matchesToken(value: string, hash: string) {
  return timingSafeEqual(Buffer.from(digest(value)), Buffer.from(hash));
}
let placeholder: Promise<string> | undefined;
// ADMIN-B21: the login failure paths verify this hash so an unknown or inactive account costs the
// same argon2 work as a real one. The input is random per process, so nothing submitted can match
// it, and the memoized promise keeps the cost to one hash for the life of the process.
export function placeholderHash() {
  placeholder ??= hashPassword(token());
  return placeholder;
}
