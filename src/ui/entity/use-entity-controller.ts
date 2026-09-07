'use client';
import { useState, useEffect, type RefObject } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveUrlState, changeUrl } from './url-state';
import type { Entity, EntityPageProps } from './types';
import { useEntityKeyboard } from './use-entity-keyboard';
export function useEntityController<T extends Entity, P extends object, C>(
  props: EntityPageProps<T, P, C>,
  root: RefObject<HTMLElement | null>,
) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const state = resolveUrlState(new URLSearchParams(params));
  const facets = Object.fromEntries(
    (props.filters ?? []).map((f) => [f.key, params.get(f.key) ?? '']),
  );
  const list = props.useList({ view: state.view, q: state.q, ...facets });
  const detail = props.useDetail(state.id, state.view === 'trash');
  const selected = (params.get('sel') ?? '').split(',').filter(Boolean);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const navigate = (patch: Record<string, string | null>, replace = false) => {
    const query = changeUrl(new URLSearchParams(window.location.search), patch);
    router[replace ? 'replace' : 'push'](`${path}${query ? '?' + query : ''}`, { scroll: false });
  };
  const close = () => {
    navigate({ id: null, new: null });
    const row = list.items[focused];
    if (row)
      document
        .querySelector<HTMLButtonElement>(`[data-row-id="${CSS.escape(row.id)}"]`)
        ?.focus({ preventScroll: true });
  };
  const move = (direction: number) => {
    const index = list.items.findIndex((item) => item.id === state.id);
    const next = list.items[index + direction];
    if (next) navigate({ id: next.id }, true);
    else if (direction > 0 && list.more) void list.fetchMore();
  };
  useDefaultView(list.defaultView, Boolean(state.id || state.creating));
  useEntityKeyboard(root, {
    items: list.items,
    focused,
    setFocused,
    navigate,
    close,
    panel: Boolean(state.id || state.creating),
  });
  const { creating, submit } = useEntityCreate(props.mutations.create, navigate);
  return {
    state,
    facets,
    list,
    detail,
    selected,
    filtersOpen,
    setFiltersOpen,
    creating,
    setFocused,
    navigate,
    close,
    move,
    submit,
  };
}
export type EntityController<T extends Entity, P extends object, C> = ReturnType<
  typeof useEntityController<T, P, C>
>;

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
