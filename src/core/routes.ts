// The only place application URLs are spelled out. Client-safe; used by pages, links and services.
type Query = Record<string, string | null | undefined>;
type Optional<K extends string> = Partial<Record<K, string | null | undefined>>;
function withQuery(path: string, query: Query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}
export type AdminPage = 'users' | 'settings' | 'ai' | 'backups' | 'jobs' | 'audit';
export const routes = {
  root: () => '/',
  home: () => '/home',
  tasks: (query?: Optional<'view' | 'id' | 'ownerId' | 'sort'>) => withQuery('/tasks', query),
  people: (query?: Optional<'view' | 'id'>) => withQuery('/people', query),
  person: (personId: string) => withQuery('/people', { id: personId }),
  admin: (page: AdminPage) => `/admin/${page}`,
  login: () => '/login',
  setup: () => '/setup',
  recovery: () => '/recovery',
};
