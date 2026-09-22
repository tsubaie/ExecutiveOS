import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from '../security-headers';
const production = { development: false, https: true };
describe('security headers', () => {
  it('ADMIN-B34 documents allow only same-origin scripts and scripts carrying the request nonce', () => {
    const policy = contentSecurityPolicy({ nonce: 'abc123', ...production });
    const directives = Object.fromEntries(
      policy.split('; ').map((part) => [part.split(' ')[0], part.split(' ').slice(1).join(' ')]),
    );
    expect(directives['script-src']).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(directives['frame-ancestors']).toBe("'none'");
    expect(directives['object-src']).toBe("'none'");
    expect(directives['base-uri']).toBe("'none'");
    expect(directives['default-src']).toBe("'self'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain('upgrade-insecure-requests');
  });
  it('ADMIN-B34 development alone adds unsafe-eval, and plain HTTP drops HSTS and upgrades', () => {
    const dev = securityHeaders({ nonce: 'n', development: true, https: false });
    expect(dev['Content-Security-Policy']).toContain("'unsafe-eval'");
    expect(dev['Content-Security-Policy']).not.toContain('upgrade-insecure-requests');
    expect(dev['Strict-Transport-Security']).toBeUndefined();
    const prod = securityHeaders({ nonce: 'n', ...production });
    expect(prod['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });
  it('ADMIN-B34 every response is nosniff, unframeable and same-origin for referrers', () => {
    for (const nonce of ['n', null]) {
      const headers = securityHeaders({ nonce, ...production });
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Referrer-Policy']).toBe('same-origin');
      expect(headers['Permissions-Policy']).toContain('camera=()');
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    }
  });
  it('ADMIN-B34 API and download responses are never cached and allow no active content', () => {
    const api = securityHeaders({ nonce: null, ...production });
    expect(api['Cache-Control']).toBe('no-store');
    expect(api['Content-Security-Policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    expect(securityHeaders({ nonce: 'n', ...production })['Cache-Control']).toBeUndefined();
  });
});
