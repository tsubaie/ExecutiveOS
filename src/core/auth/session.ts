import 'server-only';
import { cookies } from 'next/headers';
import { secureCookies } from '@/core/config/env';
import { defaults, Locale } from '@/core/config/defaults';
import { type Database } from '@/core/db/client';
import { id } from '@/core/db/ids';
import { insertSession, sessionByHash, refreshSession } from '@/core/db/auth-repo';
import { digest, token } from './password';
import { User } from './validation';

const sessionDays = 30;
export async function newSession(database: Database, userId: string) {
  const raw = token();
  const now = new Date();
  await insertSession(database, {
    id: id(),
    userId,
    tokenHash: digest(raw),
    issuedAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + sessionDays * 86400000),
    absoluteExpiresAt: new Date(now.getTime() + 90 * 86400000),
  });
  return raw;
}
// ACCT-B09: the cookie lives exactly as long as the session row, so it never outlasts a revoked or
// expired session and never lapses while the session is still being extended.
export async function setSessionCookie(raw: string, expiresAt?: Date) {
  const seconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : sessionDays * 86400;
  (await cookies()).set(defaults.cookieName, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: seconds,
  });
}
export function slidingExpiry(absoluteExpiresAt: Date, now = Date.now()) {
  return new Date(Math.min(now + sessionDays * 86400000, absoluteExpiresAt.getTime()));
}
export async function setLocaleCookie(locale: string) {
  (await cookies()).set('eos_locale', Locale.parse(locale), {
    path: '/',
    sameSite: 'lax',
    maxAge: 31536000,
  });
}
/**
 * ACCT-B09 the session slides only where the response can carry the new cookie: API requests
 * pass `slide`, and each extension of the row's expiry re-issues the cookie with the same
 * lifetime, capped by the absolute expiry. Page renders read the session without changing it,
 * because a Server Component cannot set cookies.
 */
export async function currentUser(options: { slide?: boolean } = {}) {
  const raw = (await cookies()).get(defaults.cookieName)?.value;
  if (!raw) return null;
  const found = await sessionByHash(digest(raw));
  if (!found) return null;
  if (options.slide && Date.now() - found.session.lastSeenAt.getTime() > 60000) {
    const expiry = slidingExpiry(found.session.absoluteExpiresAt);
    await refreshSession(found.session.id, expiry);
    await setSessionCookie(raw, expiry);
  }
  return User.parse(found.user);
}
// ACCT-B02/B03: which session is making this request. The cookie is the only thing a request knows
// about itself, so the hash of it is how the account page marks "this device" and how a password
// change keeps the tab it was made in while revoking the rest. Read-only: it derives a value the
// session lookup already computes and changes nothing about the session model (ADR 0005).
export async function currentSessionHash() {
  const raw = (await cookies()).get(defaults.cookieName)?.value;
  return raw ? digest(raw) : null;
}
export type Context = { user: User; db: Database; requestId: string };
