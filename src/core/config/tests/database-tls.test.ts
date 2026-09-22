import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { databaseTlsIssue, isPrivateDatabaseHost, libpqTls, poolConnection } from '../database-tls';
const rootCert = fileURLToPath(
  new URL('../../../../tests/fixtures/sample-ca.pem', import.meta.url),
);
const remote = 'postgresql://user:pass@db.example.test:5432/app';
describe('database TLS policy', () => {
  it('ADMIN-B35 Compose service names, loopback and sockets are private; everything else is remote', () => {
    for (const host of [
      'db',
      'executiveos-db',
      'postgres_16',
      'localhost',
      '127.0.0.1',
      '[::1]',
      '',
    ])
      expect(isPrivateDatabaseHost(host)).toBe(true);
    for (const host of ['db.example.test', '10.0.0.5', '192.168.1.20', 'rds.amazonaws.com'])
      expect(isPrivateDatabaseHost(host)).toBe(false);
  });
  it('ADMIN-B35 a remote host is refused unless the URL requires verify-full', () => {
    for (const mode of [
      '',
      '?sslmode=disable',
      '?sslmode=prefer',
      '?sslmode=require',
      '?sslmode=verify-ca',
    ])
      expect(databaseTlsIssue(`${remote}${mode}`)).toMatch(/sslmode=verify-full/u);
    expect(databaseTlsIssue(`${remote}?sslmode=verify-full`)).toBeNull();
    expect(databaseTlsIssue('postgresql://user:pass@db:5432/app')).toBeNull();
  });
  it('ADMIN-B35 the pool verifies the remote certificate and host name against the configured CA', () => {
    const options = poolConnection(`${remote}?sslmode=verify-full&sslrootcert=/x.pem`, rootCert);
    expect(options.connectionString).toBe(remote);
    expect(options.ssl).toEqual({
      rejectUnauthorized: true,
      servername: 'db.example.test',
      ca: '-----BEGIN CERTIFICATE-----\nc2FtcGxlIGNlcnRpZmljYXRlIGZvciB0ZXN0cw==\n-----END CERTIFICATE-----\n',
    });
    expect(poolConnection(`${remote}?sslmode=verify-full`, undefined).ssl).toEqual({
      rejectUnauthorized: true,
      servername: 'db.example.test',
    });
    expect(() => poolConnection(`${remote}?sslmode=verify-full`, '/missing/ca.pem')).toThrow(
      'DATABASE_SSL_ROOT_CERT could not be read',
    );
    expect(poolConnection('postgresql://u:p@db:5432/app', rootCert)).toEqual({
      connectionString: 'postgresql://u:p@db:5432/app',
    });
  });
  it('ADMIN-B35 pg_dump and pg_restore share the policy', () => {
    expect(libpqTls(`${remote}?sslmode=verify-full`, rootCert)).toEqual({
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: rootCert,
    });
    expect(libpqTls(`${remote}?sslmode=verify-full`, undefined)).toEqual({
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: 'system',
    });
    expect(libpqTls('postgresql://u:p@db:5432/app', undefined)).toEqual({ PGSSLMODE: 'prefer' });
  });
});
