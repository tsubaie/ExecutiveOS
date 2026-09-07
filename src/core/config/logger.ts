import 'server-only';
import pino from 'pino';
export const logger = pino({
  redact: ['password', 'passwordHash', 'token', 'apiKey', 'authorization', 'cookie'],
});
