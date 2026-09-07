import { z } from 'zod';

export const ErrorCode = z.enum([
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'rule_violation',
  'rate_limited',
  'ai_unavailable',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const statuses: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rule_violation: 422,
  rate_limited: 429,
  ai_unavailable: 503,
  internal: 500,
};
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public details: z.infer<ReturnType<typeof z.json>> = null,
  ) {
    super(code);
  }
}
