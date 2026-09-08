import 'server-only';
import pino from 'pino';
import { redact } from './redact';
// ADMIN-B18: every logged object is redacted recursively, so a secret nested inside an error,
// request or provider payload never reaches a durable log. The one-time SETUP_TOKEN line
// (ADMIN-B01) is deliberately printed in full and its transport is privileged by definition.
export const logger = pino({ formatters: { log: redact } });
