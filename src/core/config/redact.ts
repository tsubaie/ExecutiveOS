// ADMIN-B18: secrets travel inside nested request, error, provider and job objects, so redaction
// walks the whole logged value instead of a list of root paths. Keys are compared without
// separators so `api_key`, `apiKey` and `API-KEY` are one rule.
const secretKeys = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'temporarypassword',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'setuptoken',
  'recoverytoken',
  'sessiontoken',
  'idempotencykey',
  'apikey',
  'anthropicapikey',
  'secret',
  'sessionsecret',
  'authorization',
  'cookie',
  'setcookie',
  'prompt',
  'prompts',
  'systemprompt',
  'privatenote',
  'privatenotes',
]);
export const censor = '[redacted]';
const maxDepth = 8;
// What a redacted log line may contain: primitives, arrays and plain objects, nothing that could
// still hold a live reference to a request, a provider client or an error's own properties.
type Censored =
  string | number | boolean | bigint | null | undefined | Censored[] | { [key: string]: Censored };
type SerializedError = {
  type: string;
  message: string;
  stack: string | undefined;
  cause?: SerializedError;
};
export function isSecretKey(key: string) {
  return secretKeys.has(key.toLowerCase().replaceAll(/[^a-z0-9]/gu, ''));
}
// Errors are serialized through an allowlist: a thrown AppError carries `details`, and a driver
// error carries the failing statement, neither of which belongs in a durable log.
function serializeError(error: Error, depth: number): SerializedError {
  const cause = error.cause;
  return {
    type: error.name,
    message: error.message,
    stack: error.stack,
    ...(cause instanceof Error && depth < maxDepth
      ? { cause: serializeError(cause, depth + 1) }
      : {}),
  };
}
// `path` holds the ancestors of the current value, so a cycle is cut without censoring a value
// that simply appears twice in the same payload.
function walk(value: unknown, depth: number, path: Set<object>): Censored {
  if (value instanceof Error) return walk(serializeError(value, depth), depth, path);
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return container(value, depth, path);
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean' || typeof value === 'bigint') return value;
  // What is left is a function or a symbol: never useful in a log line, and a closure can reach
  // anything the call site could.
  return censor;
}
function container(value: object, depth: number, path: Set<object>): Censored {
  if (depth >= maxDepth || path.has(value)) return censor;
  path.add(value);
  const walked = Array.isArray(value)
    ? value.map((item) => walk(item, depth + 1, path))
    : entries(value, depth, path);
  path.delete(value);
  return walked;
}
function entries(value: object, depth: number, path: Set<object>) {
  const result: { [key: string]: Censored } = {};
  for (const [key, item] of Object.entries(value))
    result[key] = isSecretKey(key) ? censor : walk(item, depth + 1, path);
  return result;
}
export function redact(value: object) {
  return entries(value, 0, new Set([value]));
}
