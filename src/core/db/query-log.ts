import 'server-only';
// Counts statements issued through the Drizzle client; used by audit:perf and query-budget tests.
type Listener = (query: string) => void;
const listeners = new Set<Listener>();
export const queryLogger = {
  logQuery(query: string) {
    if (/^(?:begin|commit|rollback)\b/iu.test(query.trim())) return;
    for (const listener of listeners) listener(query);
  },
};
export async function countQueries<T>(work: () => Promise<T>) {
  let queries = 0;
  const listener: Listener = () => {
    queries += 1;
  };
  listeners.add(listener);
  try {
    const result = await work();
    return { result, queries };
  } finally {
    listeners.delete(listener);
  }
}
