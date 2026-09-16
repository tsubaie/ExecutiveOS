import { vi } from 'vitest';
import type { EntityController } from '../use-entity-controller';
import type { Entity, EntityPageProps } from '../types';
// Real config and controller objects rather than casts: the framework hands every piece the whole
// surface, so a test of one piece has to build one. Building it honestly is also what catches a
// renamed field, which a cast would hide.
export type TestRow = Entity & { name: string; score: number };
export function testRow(id: string, name: string, score: number): TestRow {
  return { id, revision: 1, deletedAt: null, deletedOpId: null, name, score };
}
type Props = EntityPageProps<TestRow, object, object>;
export function testConfig(overrides: Partial<Props> = {}): Props {
  return {
    module: 'measures',
    title: 'Measures',
    searchLabel: 'Search measures',
    description: 'Every measure.',
    filters: { views: [] },
    useList: () => testList(),
    useDetail: () => ({ data: undefined, pending: false, error: null, refetch: async () => undefined }),
    mutations: {
      patch: async () => testRow('a', 'Alpha', 0),
      create: async () => null,
      remove: async () => ({ opId: 'op' }),
      restore: async () => testRow('a', 'Alpha', 0),
    },
    renderers: {
      row: (item) => item.name,
      detail: () => null,
      create: () => null,
      name: (item) => item.name,
      deletedMessage: 'Measure moved to trash',
    },
    ...overrides,
  };
}
function testList() {
  return {
    items: [] as TestRow[],
    counts: {},
    pending: false,
    error: null,
    more: false,
    fetchMore: async () => undefined,
    refetch: () => undefined,
  };
}
type Controller = EntityController<TestRow, object, object>;
export function testController(overrides: Partial<Controller> = {}): Controller {
  return {
    state: { creating: false, id: null, view: 'all', q: '', sort: '', layout: '' },
    setLayout: vi.fn(),
    facets: {},
    searchReset: 0,
    clearFilters: vi.fn(),
    selecting: false,
    setSelecting: vi.fn(),
    railOpen: true,
    setRailOpen: vi.fn(),
    list: testList(),
    detail: { data: undefined, pending: false, error: null, refetch: async () => undefined },
    selected: [],
    filtersOpen: false,
    setFiltersOpen: vi.fn(),
    creating: false,
    setFocused: vi.fn(),
    navigate: vi.fn(),
    close: vi.fn(),
    move: vi.fn(),
    neighbors: { previous: false, next: false, position: 0, count: 0, move: vi.fn() },
    submit: vi.fn(),
    ...overrides,
  };
}
