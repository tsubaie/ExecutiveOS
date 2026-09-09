import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
export type Entity = {
  id: string;
  revision: number;
  deletedAt: string | null;
  deletedOpId: string | null;
};
// `separated` draws a divider before the view in the rail (archive views such as Completed, Trash);
// `featured` views also show their count in the strip above the list, tinted by `tone` when > 0.
export type View = {
  id: string;
  label: string;
  icon?: LucideIcon;
  separated?: boolean;
  featured?: boolean;
  tone?: 'danger' | 'accent';
};
export type Facet = { key: string; label: string; options: { value: string; label: string }[] };
export type SortOption = { id: string; label: string };
// Views, facets and sort are declared together; the framework owns their URL state.
export type FiltersDef = {
  views: View[];
  facets?: Facet[];
  sort?: { options: SortOption[]; default: string };
};
export type Filters = { view: string; q: string; sort: string; [key: string]: string };
export type ListResult<T> = {
  defaultView?: string | undefined;
  items: T[];
  counts: Record<string, number>;
  pending: boolean;
  error: Error | null;
  more: boolean;
  fetchMore: () => Promise<void>;
  refetch: () => void;
};
export type DetailResult<T> = {
  data: T | undefined;
  pending: boolean;
  error: Error | null;
  refetch: () => Promise<T | undefined>;
};
export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type Neighbors = { previous: boolean; next: boolean; position: number; count: number };
export type DetailApi<P> = {
  save: (patch: P) => void;
  close: () => void;
  remove: () => void;
  restore: () => void;
  saveState: SaveState;
  retry: () => void;
  next: () => void;
  prev: () => void;
  neighbors: Neighbors;
};
export type CreateApi<C, T> = {
  submit: (input: C) => Promise<T | null>;
  cancel: () => void;
  pending: boolean;
};
// A bulk action either runs directly (optionally after a confirm dialog) or renders its own dialog.
// `finish(true)` clears the selection; `finish(false)` only closes.
export type BulkAction<T> = {
  id: string;
  label: string;
  enabled?: (items: T[]) => boolean;
  confirm?: { title: string; description: string };
  run?: (items: T[]) => Promise<void>;
  render?: (items: T[], finish: (clearSelection: boolean) => void) => ReactNode;
};
export type EmptyState = {
  title: string;
  description: string;
  action?: { label: string; onSelect: () => void };
  icon?: LucideIcon;
};
export type EntityPageProps<T extends Entity, P, C> = {
  module: string;
  title: string;
  description: string;
  filters: FiltersDef;
  bulkActions?: BulkAction<T>[];
  emptyState?: Partial<EmptyState>;
  group?: (item: T) => string | null;
  rowAction?: (item: T) => ReactNode;
  useList: (filters: Filters) => ListResult<T>;
  useDetail: (id: string | null, trash: boolean) => DetailResult<T>;
  mutations: {
    patch: (id: string, revision: number, patch: P, key: string) => Promise<T>;
    create: (input: C) => Promise<T | null>;
    remove: (id: string, revision: number) => Promise<{ opId: string }>;
    restore: (id: string, opId: string) => Promise<T>;
  };
  renderers: {
    row: (item: T) => ReactNode;
    // Rendered beside the row button rather than inside it, so it may hold its own control.
    rowTrail?: (item: T) => ReactNode;
    detail: (item: T, api: DetailApi<P>) => ReactNode;
    create: (api: CreateApi<C, T>) => ReactNode;
    name: (item: T) => string;
  };
};
