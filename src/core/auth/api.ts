import 'server-only';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { defineHandler, authenticated } from '@/core/http/handler';
import { Login, User, Recovery } from './validation';
import { login, recover } from './login';
import { setSessionCookie } from './session';
import { revokeSession } from '@/core/db/auth-repo';
import { digest } from './password';
import { defaults } from '@/core/config/defaults';
import { clientIp } from '@/core/http/client-ip';
export const loginApi = defineHandler({
  guard: 'public',
  input: Login,
  response: z.object({ data: User }),
  handler: async (input, _context, _params, request) => {
    const result = await login(input, clientIp(request));
    await setSessionCookie(result.token);
    return { data: result.user };
  },
});
export const recoveryApi = defineHandler({
  guard: 'public',
  input: Recovery,
  response: z.object({ data: z.null() }),
  handler: async (input, _context, _params, request) => {
    await recover(input, clientIp(request));
    return { data: null };
  },
});
export const logoutApi = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: z.null() }),
  handler: async (_, ctx) => {
    const jar = await cookies();
    const raw = jar.get(defaults.cookieName)?.value;
    if (raw) await revokeSession(digest(raw), ctx.db);
    jar.delete(defaults.cookieName);
    return { data: null };
  },
});
export const meApi = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: User }),
  handler: async (_, ctx) => ({ data: authenticated(ctx).user }),
});
