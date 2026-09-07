'use client';
import { useState, useEffect, useCallback, type RefObject } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveUrlState, changeUrl, clearEntityFilters } from './url-state';
import type { Entity, EntityPageProps } from './types';
import { useEntityNavigation } from './navigation';
import { useEntityNeighbors } from './use-entity-neighbors';
import { useEntityKeyboard } from './use-entity-keyboard';
export function useEntityController<T extends Entity, P extends object, C>(
  props: EntityPageProps<T, P, C>,
  root: RefObject<HTMLElement | null>,
) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const guarded = useEntityNavigation();
  const state = resolveUrlState(new URLSearchParams(params));
  const sort = state.sort || (props.filters.sort?.default ?? '');
  const facets = Object.fromEntries(
    (props.filters.facets ?? []).map((f) => [f.key, params.get(f.key) ?? '']),
  );
  const list = props.useList({ view: state.view, q: state.q, sort, ...facets });
  const detail = props.useDetail(state.id, state.view === 'trash');
  const selected = (params.get('sel') ?? '').split(',').filter(Boolean);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const navigate = useGuardedNavigate(guarded, path, router);
  const close = useCallback(() => navigate({ id: null, new: null }), [navigate]);
  const neighbors = useEntityNeighbors(list, state.id, navigate);
  useDefaultView(list.defaultView, Boolean(state.id || state.creating));
  useControllerKeyboard(root, {
    list,
    focused,
    setFocused,
    navigate,
    close,
    panel: Boolean(state.id || state.creating),
    selected,
    selectable: Boolean(props.bulkActions?.length),
    setSelecting,
  });
  const { creating, submit } = useEntityCreate(props.mutations.create, navigate);
  return {
    state: { ...state, sort },
    facets,
    clearFilters: (id: string | null = null) =>
      navigate({ ...clearEntityFilters(Object.keys(facets)), id }, true),
    selecting: selecting || selected.length > 0,
    setSelecting,
    ...{ railOpen, setRailOpen },
    list,
    detail,
    ...{ selected, filtersOpen, setFiltersOpen },
    ...{ creating, setFocused, navigate, close },
    move: neighbors.move,
    neighbors,
    submit,
  };
}
export type EntityController<T extends Entity, P extends object, C> = ReturnType<
  typeof useEntityController<T, P, C>
>;

function useGuardedNavigate(
  guarded: (action: () => void) => void,
  path: string,
  router: ReturnType<typeof useRouter>,
) {
  return useCallback(
    (patch: Record<string, string | null>, replace = false) => {
      const query = changeUrl(new URLSearchParams(window.location.search), patch);
      guarded(() =>
        router[replace ? 'replace' : 'push'](`${path}${query ? '?' + query : ''}`, {
          scroll: false,
        }),
      );
    },
    [guarded, path, router],
  );
}
type KeyboardArgs<T extends Entity> = {
  list: { items: T[] };
  focused: number;
  setFocused: (index: number) => void;
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void;
  close: () => void;
  panel: boolean;
  selected: string[];
  selectable: boolean;
  setSelecting: (value: boolean) => void;
};
function useControllerKeyboard<T extends Entity>(
  root: RefObject<HTMLElement | null>,
  args: KeyboardArgs<T>,
) {
  useEntityKeyboard(root, {
    items: args.list.items,
    focused: args.focused,
    setFocused: args.setFocused,
    navigate: args.navigate,
    close: args.close,
    panel: args.panel,
    selected: args.selected,
    selectable: args.selectable,
    select: () => args.setSelecting(true),
    clear: () => {
      args.navigate({ sel: null }, true);
      args.setSelecting(false);
    },
    openBulk: () => {
      args.setSelecting(true);
      root.current?.querySelector<HTMLElement>('[data-entity-bulk] button')?.focus();
    },
  });
}
function useDefaultView(defaultView: string | undefined, panel: boolean) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  // sync: record the module default view in the URL once counts arrive.
  useEffect(() => {
    if (!params.has('view') && defaultView && !panel) {
      const next = new URLSearchParams(params);
      next.set('view', defaultView);
      router.replace(`${path}?${next}`, { scroll: false });
    }
  }, [params, router, path, defaultView, panel]);
}
function useEntityCreate<T extends Entity, C>(
  create: (input: C) => Promise<T | null>,
  navigate: (patch: Record<string, string | null>) => void,
) {
  const [creating, setCreating] = useState(false);
  const submit = async (input: C) => {
    setCreating(true);
    try {
      const item = await create(input);
      if (item) navigate({ id: item.id, new: null });
      return item;
    } finally {
      setCreating(false);
    }
  };
  return { creating, submit };
}
