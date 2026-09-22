import 'server-only';
export type HeaderPolicyInput = {
  // A fresh per-request nonce for HTML documents; null for API and other non-document responses.
  nonce: string | null;
  development: boolean;
  // True only for a production deployment served over HTTPS; drives HSTS and upgrade-insecure-requests.
  https: boolean;
};
/**
 * ADMIN-B34 one header policy for every response the app serves. Script execution is limited to
 * same-origin files and scripts carrying this request's nonce ('strict-dynamic' lets those load
 * their own chunks). Exceptions, each recorded in ADR 0025:
 * - style-src 'unsafe-inline': Base UI, sonner and recharts set style attributes and inject
 *   style elements at runtime, and a nonce cannot cover attributes.
 * - script-src 'unsafe-eval' in development only: React's dev build reconstructs server stacks with eval.
 */
export function contentSecurityPolicy({ nonce, development, https }: HeaderPolicyInput) {
  if (nonce === null) return "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
export function securityHeaders(input: HeaderPolicyInput): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(input),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    // API responses carry private workspace data; downloads are API responses too.
    ...(input.nonce === null ? { 'Cache-Control': 'no-store' } : {}),
    ...(input.https ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}
