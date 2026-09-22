import 'server-only';
import type { Database } from './client';
type Arg = string | number | boolean | bigint | object | null | undefined;
const marker = Symbol.for('executiveos.transactional');
/**
 * 07-coding-guidelines § Data access: the service opens the transaction. A public service method
 * wrapped here is atomic however it is called. From a script or another module with the pool it
 * opens a transaction; inside the request handler's transaction it becomes a savepoint, so a
 * failure rolls back only the method's own writes before the error reaches the handler.
 */
export function transactional<C extends { db: Database }, A extends Arg[], R>(
  work: (ctx: C, ...args: A) => Promise<R>,
) {
  const wrapped = (ctx: C, ...args: A) =>
    ctx.db.transaction((database) => work({ ...ctx, db: database }, ...args));
  return Object.assign(wrapped, { [marker]: true });
}
export function isTransactional(value: Arg) {
  return typeof value === 'function' && marker in value;
}
