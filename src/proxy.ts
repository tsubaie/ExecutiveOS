import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/core/config/env';
import { securityHeaders } from '@/core/http/security-headers';
// ADMIN-B34: every response leaves through this policy. Documents get a fresh nonce, forwarded to
// the render in the request's own CSP header so Next stamps it on its scripts.
export function proxy(request: NextRequest) {
  const config = env();
  const document = !request.nextUrl.pathname.startsWith('/api/');
  const nonce = document ? Buffer.from(crypto.randomUUID()).toString('base64') : null;
  const headers = securityHeaders({
    nonce,
    development: config.NODE_ENV === 'development',
    https: config.NODE_ENV === 'production' && config.APP_URL.startsWith('https:'),
  });
  const forwarded = new Headers(request.headers);
  if (nonce) {
    forwarded.set('x-nonce', nonce);
    forwarded.set('Content-Security-Policy', headers['Content-Security-Policy'] ?? '');
  }
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
