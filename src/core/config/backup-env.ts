import 'server-only';
import { env } from './env';
import { libpqTls } from './database-tls';
export function postgresConnection() {
  const url = new URL(env().DATABASE_URL);
  return {
    args: [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      decodeURIComponent(url.pathname.slice(1)),
    ],
    environment: {
      NODE_ENV: env().NODE_ENV,
      PGPASSWORD: decodeURIComponent(url.password),
      ...libpqTls(env().DATABASE_URL, env().DATABASE_SSL_ROOT_CERT),
    },
  };
}
