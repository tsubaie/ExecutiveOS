import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '@/core/config/env';
import { clientIp } from '../client-ip';
const base = {
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  SESSION_SECRET: 'a'.repeat(32),
};
const config = (TRUSTED_PROXY_CIDRS: string) => parseEnvironment({ ...base, TRUSTED_PROXY_CIDRS });
function requestFrom(forwarded?: string) {
  return new Request('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    ...(forwarded === undefined ? {} : { headers: { 'x-forwarded-for': forwarded } }),
  });
}
describe('trusted client address', () => {
  it('ADMIN-B20 forwarded addresses are untrusted until a proxy CIDR is configured', () => {
    expect(clientIp(requestFrom('203.0.113.9'), config(''))).toBeNull();
    expect(clientIp(requestFrom('203.0.113.9'), config('10.0.0.0/8'))).toBe('203.0.113.9');
  });
  it('ADMIN-B20 the client is the last hop outside the trusted proxies, so prepending is inert', () => {
    const trusted = config('10.0.0.0/8, 192.168.0.0/16');
    expect(clientIp(requestFrom('203.0.113.9, 10.0.0.7'), trusted)).toBe('203.0.113.9');
    // An attacker controls only what it prepends; the proxy appends the address it actually saw.
    expect(clientIp(requestFrom('1.1.1.1, 203.0.113.9, 10.0.0.7'), trusted)).toBe('203.0.113.9');
    expect(clientIp(requestFrom('203.0.113.9, 192.168.1.4, 10.0.0.7'), trusted)).toBe(
      '203.0.113.9',
    );
  });
  it('ADMIN-B20 an absent header or an all-proxy chain resolves to no client address', () => {
    const trusted = config('10.0.0.0/8');
    expect(clientIp(requestFrom(), trusted)).toBeNull();
    expect(clientIp(requestFrom(''), trusted)).toBeNull();
    expect(clientIp(requestFrom('10.0.0.7, 10.0.0.8'), trusted)).toBeNull();
    expect(clientIp(requestFrom('not-an-address'), trusted)).toBeNull();
  });
  it('ADMIN-B20 addresses are normalized across ports, brackets, zones and IPv6 proxies', () => {
    const trusted = config('fd00::/8, 10.0.0.0/8');
    expect(clientIp(requestFrom('203.0.113.9:41234, 10.0.0.7'), trusted)).toBe('203.0.113.9');
    expect(clientIp(requestFrom('[2001:db8::5]:41234, fd00::1'), trusted)).toBe('2001:db8::5');
    expect(clientIp(requestFrom('2001:DB8::5, fd00::1'), trusted)).toBe('2001:db8::5');
    expect(clientIp(requestFrom('fe80::1%eth0, 10.0.0.7'), trusted)).toBe('fe80::1');
  });
});
