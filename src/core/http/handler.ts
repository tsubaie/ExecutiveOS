import 'server-only';
import { z } from 'zod';
import { db, type Database } from '@/core/db/client';
import { currentUser, type Context } from '@/core/auth/session';
import { digest } from '@/core/auth/password';
import { id } from '@/core/db/ids';
import { lockRequest, replayRequest, storeRequest, maintenance } from '@/core/db/http-repo';
import { AppError, statuses } from './errors';
import { checkOrigin } from './origin';
import { logger } from '@/core/config/logger';
import { getTranslations } from 'next-intl/server';
import type { User } from '@/core/auth/validation';
import { isRestoring } from '@/core/backup/maintenance';

let maintenanceState: { value: boolean; expires: number } | undefined;
// Both checks hit storage; two seconds of staleness is acceptable for a maintenance banner.
async function inMaintenance() {
  if (maintenanceState && maintenanceState.expires > Date.now()) return maintenanceState.value;
  const value = (await isRestoring()) || (await maintenance(db()));
  maintenanceState = { value, expires: Date.now() + 2000 };
  return value;
}
export function resetMaintenanceCache() {
  maintenanceState = undefined;
}

type HandlerContext = { user: User | null; db: Database; requestId: string };
export type HandlerMeta = {
  guard: 'public' | 'session' | 'admin';
  input: z.ZodType;
  response: z.ZodType;
  status: number;
  source: 'body' | 'query';
  idempotent: boolean;
};
type Options<I extends z.ZodType, O extends z.ZodType> = {
  guard: 'public' | 'session' | 'admin';
  input: I;
  response: O;
  source?: 'body' | 'query';
  status?: number;
  idempotent?: boolean;
  handler: (
    input: z.output<I>,
    ctx: HandlerContext,
    params: Record<string, string>,
    request: Request,
  ) => Promise<z.input<O>>;
};
export function authenticated(ctx: HandlerContext): Context {
  if (!ctx.user) throw new AppError('unauthenticated');
  return { ...ctx, user: ctx.user };
}
async function inputFor(request: Request, source?: 'body' | 'query') {
  if (source === 'query' || request.method === 'GET')
    return Object.fromEntries(new URL(request.url).searchParams);
  const body = await request.text();
  if (body.length > 1000000) throw new AppError('validation_failed');
  try {
    return body ? z.json().parse(JSON.parse(body)) : {};
  } catch {
    throw new AppError('validation_failed');
  }
}
export function defineHandler<I extends z.ZodType, O extends z.ZodType>(options: Options<I, O>) {
  const handler = async (request: Request, route?: { params: Promise<Record<string, string>> }) => {
    const requestId = id();
    try {
      if (await inMaintenance())
        return Response.json({ error: { code: 'maintenance', requestId } }, { status: 503 });
      const user = await currentUser();
      if (options.guard !== 'public' && !user) throw new AppError('unauthenticated');
      if (options.guard === 'admin' && user?.role !== 'admin')
        throw new AppError('forbidden', { reason: 'role' });
      checkOrigin(request);
      const input = options.input.parse(await inputFor(request, options.source));
      const params = route ? await route.params : {};
      const result = await execute(options, input, { user, db: db(), requestId }, params, request);
      if (options.status === 204)
        return new Response(null, {
          status: 204,
          headers: {
            'X-Op-Id': z.object({ opId: z.string() }).parse(result).opId,
            'X-Request-Id': requestId,
          },
        });
      return Response.json(result, {
        status: options.status ?? 200,
        headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
  return Object.assign(handler, { meta: metaOf(options) });
}
function metaOf<I extends z.ZodType, O extends z.ZodType>(options: Options<I, O>): HandlerMeta {
  return {
    guard: options.guard,
    input: options.input,
    response: options.response,
    status: options.status ?? 200,
    source: options.source ?? 'body',
    idempotent: options.idempotent ?? false,
  };
}
async function execute<I extends z.ZodType, O extends z.ZodType>(
  options: Options<I, O>,
  input: z.output<I>,
  ctx: HandlerContext,
  params: Record<string, string>,
  request: Request,
) {
  return db().transaction(async (database) => {
    const key = options.idempotent ? z.uuid().parse(request.headers.get('idempotency-key')) : null;
    const hash = digest(JSON.stringify({ method: request.method, url: request.url, input }));
    if (key && ctx.user) {
      await lockRequest(database, ctx.user.id + key);
      const previous = await replayRequest(database, ctx.user.id, key);
      if (previous) {
        if (previous.requestHash !== hash) throw new AppError('conflict', { reason: 'duplicate' });
        return previous.body;
      }
    }
    const result = options.response.parse(
      await options.handler(input, { ...ctx, db: database }, params, request),
    );
    const json = z.json().parse(result);
    if (key && ctx.user)
      await storeRequest(database, ctx.user.id, key, hash, options.status ?? 200, json);
    return json;
  });
}
async function errorResponse(error: unknown, requestId: string) {
  const parsed =
    error instanceof z.ZodError
      ? new AppError('validation_failed', {
          fieldErrors: Object.fromEntries(error.issues.map((i) => [i.path.join('.'), [i.message]])),
        })
      : error instanceof AppError
        ? error
        : new AppError('internal');
  if (parsed.code === 'internal') logger.error({ requestId, err: error }, 'Request failed');
  const t = await getTranslations('errors');
  return Response.json(
    { error: { code: parsed.code, message: t(parsed.code), details: parsed.details, requestId } },
    { status: statuses[parsed.code], headers: { 'Cache-Control': 'no-store' } },
  );
}
