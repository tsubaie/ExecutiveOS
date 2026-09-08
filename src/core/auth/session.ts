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
export async function setSessionCookie(raw: string) {
  (await cookies()).set(defaults.cookieName, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: sessionDays * 86400,
  });
}
export async function setLocaleCookie(locale: string) {
  (await cookies()).set('eos_locale', Locale.parse(locale), {
    path: '/',
    sameSite: 'lax',
    maxAge: 31536000,
  });
}
export async function currentUser() {
  const raw = (await cookies()).get(defaults.cookieName)?.value;
  if (!raw) return null;
  const found = await sessionByHash(digest(raw));
  if (!found) return null;
  if (Date.now() - found.session.lastSeenAt.getTime() > 60000)
    await refreshSession(
      found.session.id,
      new Date(
        Math.min(Date.now() + sessionDays * 86400000, found.session.absoluteExpiresAt.getTime()),
      ),
    );
  return User.parse(found.user);
}
export type Context = { user: User; db: Database; requestId: string };
