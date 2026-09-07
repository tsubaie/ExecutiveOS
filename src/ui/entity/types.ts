import type { ReactNode } from 'react';
export type Entity = {
  id: string;
  revision: number;
  deletedAt: string | null;
  deletedOpId: string | null;
};
export type Filters = { view: string; q: string; [key: string]: string };
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
export type DetailApi<P> = {
  save: (patch: P) => void;
  close: () => void;
  remove: () => void;
  restore: () => void;
  saveState: SaveState;
  retry: () => void;
};
export type CreateApi<C, T> = {
  submit: (input: C) => Promise<T | null>;
  cancel: () => void;
  pending: boolean;
};
export type EntityPageProps<T extends Entity, P, C> = {
  module: string;
  title: string;
  description: string;
  views: { id: string; label: string }[];
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  bulk?: (items: T[], clear: () => void) => ReactNode;
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
    detail: (item: T, api: DetailApi<P>) => ReactNode;
    create: (api: CreateApi<C, T>) => ReactNode;
    name: (item: T) => string;
  };
};
