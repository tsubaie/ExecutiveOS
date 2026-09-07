import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: z.infer<ReturnType<typeof z.json>>,
    public requestId: string,
  ) {
    super(message);
  }
}
const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.json(),
    requestId: z.string(),
  }),
});
export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  options: { method?: string; body?: z.infer<ReturnType<typeof z.json>>; key?: string } = {},
) {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'ExecutiveOS',
      'Idempotency-Key': options.key ?? crypto.randomUUID(),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (response.status === 204) return schema.parse({ opId: response.headers.get('X-Op-Id') });
  const raw: z.infer<ReturnType<typeof z.json>> = z.json().parse(await response.json());
  if (!response.ok) {
    const parsed = ErrorBody.parse(raw);
    throw new ApiError(
      parsed.error.code,
      parsed.error.message,
      parsed.error.details,
      parsed.error.requestId,
    );
  }
  return schema.parse(raw);
}
