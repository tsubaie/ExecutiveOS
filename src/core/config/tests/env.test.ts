import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseEnvironment, secureCookies } from '../env';
const base = {
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  SESSION_SECRET: 'a'.repeat(32),
};
describe('environment', () => {
  it('ADMIN-B17 production refuses a plain-HTTP APP_URL and keeps the loopback opt-out', () => {
    const attempt = (NODE_ENV: string, APP_URL: string) =>
      parseEnvironment({ ...base, NODE_ENV, APP_URL });
    expect(() => attempt('production', 'http://office.example.test')).toThrow(z.ZodError);
    try {
      attempt('production', 'http://office.example.test');
    } catch (error) {
      expect(error instanceof z.ZodError && error.issues[0]?.path).toEqual(['APP_URL']);
    }
    expect(attempt('production', 'https://office.example.test').APP_URL).toBe(
      'https://office.example.test',
    );
    expect(attempt('production', 'http://localhost:3000').APP_URL).toBe('http://localhost:3000');
    expect(attempt('production', 'http://127.0.0.1:3000').APP_URL).toBe('http://127.0.0.1:3000');
    expect(attempt('development', 'http://office.example.test').APP_URL).toBe(
      'http://office.example.test',
    );
  });
  it('ADMIN-B17 the session cookie Secure flag follows the validated deployment mode', () => {
    const flag = (NODE_ENV: string, APP_URL: string) =>
      secureCookies(parseEnvironment({ ...base, NODE_ENV, APP_URL }));
    expect(flag('production', 'https://office.example.test')).toBe(true);
    expect(flag('production', 'http://localhost:3000')).toBe(false);
    expect(flag('development', 'http://localhost:3000')).toBe(false);
    expect(flag('development', 'https://dev.example.test')).toBe(true);
  });
  it('ADMIN-B20 trusted proxy CIDRs are validated at startup so a typo cannot disable throttling', () => {
    const attempt = (TRUSTED_PROXY_CIDRS: string) =>
      parseEnvironment({ ...base, TRUSTED_PROXY_CIDRS });
    expect(attempt('').TRUSTED_PROXY_CIDRS).toBe('');
    expect(attempt('10.0.0.0/8, 192.168.0.0/16, fd00::/8').TRUSTED_PROXY_CIDRS).toContain(
      '10.0.0.0/8',
    );
    expect(attempt('172.18.0.5').TRUSTED_PROXY_CIDRS).toBe('172.18.0.5');
    expect(() => attempt('10.0.0.0/33')).toThrow(z.ZodError);
    expect(() => attempt('not-an-address')).toThrow(z.ZodError);
    expect(() => attempt('10.0.0.0/8, nonsense')).toThrow(z.ZodError);
  });
  it('ADMIN-B22 a configured recovery token must carry real entropy', () => {
    const attempt = (RECOVERY_TOKEN: string) => parseEnvironment({ ...base, RECOVERY_TOKEN });
    expect(attempt('').RECOVERY_TOKEN).toBeUndefined();
    expect(attempt('r'.repeat(32)).RECOVERY_TOKEN).toHaveLength(32);
    expect(() => attempt('letmein')).toThrow(z.ZodError);
    try {
      attempt('letmein');
    } catch (error) {
      expect(error instanceof z.ZodError && error.issues[0]?.path).toEqual(['RECOVERY_TOKEN']);
    }
  });
});
