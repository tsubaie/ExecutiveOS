import 'server-only';
import { env } from './env';
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
      PGSSLMODE: url.searchParams.get('sslmode') ?? 'prefer',
    },
  };
}
