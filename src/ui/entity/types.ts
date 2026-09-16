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
  featured?: boolean | 'compact';
  featuredOrder?: number;
  // The ink a featured count takes once it is above zero. `danger` and `accent` are the app's own
  // semantics; `good`, `warn` and `bad` are the status scale a scorecard reads in (docs/05 § Charts).
  tone?: 'danger' | 'accent' | 'good' | 'warn' | 'bad';
};
export type Facet = { key: string; label: string; options: { value: string; label: string }[] };
// EP-B29: one column of the table presentation. `head` names it, `cell` renders it, and `numeric`
// is the only styling a module may ask for, because it is the one that carries meaning: a column
// of figures is read down, so it takes tabular figures and sits against the column's end edge.
// `primary` marks the column that names the record and carries the control that opens it; exactly
// one column is primary, and it is the row header.
export type Column<T> = {
  key: string;
  head: string;
  cell: (item: T) => ReactNode;
  numeric?: boolean;
  primary?: boolean;
  // EP-B31: the id of the sort this column maps to, from the module's own `filters.sort` options.
  // A column that names one gets a header that orders by it; a column that does not stays plain
  // text, because a header that looks orderable and is not is worse than one that never offered.
  sort?: string;
};
export type SortOption = { id: string; label: string };
// Views, facets, sort and mode are declared together; the framework owns their URL state.
export type FiltersDef = {
  views: View[];
  facets?: Facet[];
  sort?: { options: SortOption[]; default: string };
  // EP-B28: one reading the whole list is taken under, as a segmented control in the toolbar. It
  // travels with the facets — same URL key, same query, same clearing — but it is not a filter and
  // does not read as one: it removes nothing from the list, it changes what every row of it says.
  // Its first option is the default and carries the empty value.
  mode?: { key: string; label: string; options: SortOption[] };
};
export type Filters = { view: string; q: string; sort: string; [key: string]: string };
export type ListResult<T> = {
  defaultView?: string | undefined;
  items: T[];
  counts: Record<string, number>;
  summaryCounts?: Record<string, number> | undefined;
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
  // EP-B41: what the list's own search field is called — "Search tasks", in the module's words.
  // The shell header carries a workspace search one row above it, so the field names its module
  // and reads as a filter on this list rather than as a second copy of that.
  searchLabel: string;
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
    // 'card' spaces the rows as full-width containers; 'grid' lays them out as tiles in columns
    // (EP-B27), for a list whose rows are figures rather than sentences. Either way this is the
    // presentation the reader can switch away from, and `columns` is what they switch to (EP-B29).
    rowStyle?: 'card' | 'grid';
    columns?: Column<T>[];
    row: (item: T) => ReactNode;
    // Rendered beside the row button rather than inside it, so it may hold its own control.
    rowTrail?: (item: T) => ReactNode;
    detail: (item: T, api: DetailApi<P>) => ReactNode;
    create: (api: CreateApi<C, T>) => ReactNode;
    name: (item: T) => string;
    // The localized sentence the Undo toast reads when one of these is trashed, naming the kind of
    // record rather than the record: a title is unbounded, and at this size an unbounded string
    // wraps the toast to two lines and changes its shape every time it appears. The reader has just
    // acted on that record and the name is one press away in Trash; what the receipt has to carry
    // is that the action landed and that it is reversible.
    deletedMessage: string;
  };
};
