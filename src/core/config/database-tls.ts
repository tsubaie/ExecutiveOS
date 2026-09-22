import 'server-only';
import { readFileSync } from 'node:fs';
/**
 * ADMIN-B35 database TLS policy (ADR 0025). A Compose-private host is a single-label service name
 * (`db`, `executiveos-db`), a loopback address, or a Unix socket: traffic never leaves the host's
 * container network, so the URL's own `sslmode` applies. Every other host is remote and must use
 * `sslmode=verify-full`, which checks both the certificate chain and the host name. The chain is
 * checked against DATABASE_SSL_ROOT_CERT when set, otherwise the system trust store.
 */
const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export function isPrivateDatabaseHost(hostname: string) {
  return hostname === '' || loopbackHosts.has(hostname) || /^[a-z0-9_-]+$/iu.test(hostname);
}
export function databaseTlsIssue(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (isPrivateDatabaseHost(url.hostname)) return null;
  if (url.searchParams.get('sslmode') === 'verify-full') return null;
  return `DATABASE_URL points at the remote host "${url.hostname}", which requires verified TLS: add ?sslmode=verify-full to the URL, and set DATABASE_SSL_ROOT_CERT to the provider's CA file unless the system trust store already covers it`;
}
function readRootCert(path: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`DATABASE_SSL_ROOT_CERT could not be read (${path})`, { cause: error });
  }
}
// Options for the node-postgres pool. A remote URL's TLS parameters are removed from the connection
// string because node-postgres lets them override the explicit `ssl` object.
export function poolConnection(databaseUrl: string, rootCert: string | undefined) {
  const url = new URL(databaseUrl);
  if (isPrivateDatabaseHost(url.hostname)) return { connectionString: databaseUrl };
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl'])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      servername: url.hostname,
      ...(rootCert ? { ca: readRootCert(rootCert) } : {}),
    },
  };
}
// The same policy for the pg_dump and pg_restore subprocesses (libpq 16 understands `system`).
export function libpqTls(databaseUrl: string, rootCert: string | undefined) {
  const url = new URL(databaseUrl);
  if (isPrivateDatabaseHost(url.hostname))
    return { PGSSLMODE: url.searchParams.get('sslmode') ?? 'prefer' };
  return { PGSSLMODE: 'verify-full', PGSSLROOTCERT: rootCert ?? 'system' };
}
