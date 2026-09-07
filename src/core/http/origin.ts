import 'server-only';
import { env } from '@/core/config/env';
import { AppError } from './errors';
export function checkOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  let origin = '';
  try {
    origin = new URL(request.headers.get('origin') ?? request.headers.get('referer') ?? '').origin;
  } catch {
    throw new AppError('forbidden', { reason: 'origin' });
  }
  if (
    origin !== new URL(env().APP_URL).origin ||
    request.headers.get('x-requested-with') !== 'ExecutiveOS'
  )
    throw new AppError('forbidden', { reason: 'origin' });
}
