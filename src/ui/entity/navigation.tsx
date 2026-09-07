'use client';
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
// Navigation inside an entity surface passes through registered guards (an open editor with a
// pending or failed save). Guards are scoped to the provider, so a panel embedded in another module
// only guards its own surface; nothing is attached to window.
// A guard calls `proceed` when navigation may continue, now or later (after a dialog).
export type NavigationGuard = (proceed: () => void) => void | Promise<void>;
type Value = {
  navigate: (action: () => void) => void;
  register: (guard: NavigationGuard) => () => void;
};
const passthrough: Value = { navigate: (action) => action(), register: () => () => undefined };
const Context = createContext<Value>(passthrough);
function runGuards(guards: NavigationGuard[], action: () => void) {
  const [first, ...rest] = guards;
  if (!first) return action();
  void first(() => runGuards(rest, action));
}
function ignoreLinkClick(event: MouseEvent) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
export function EntityNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guards = useRef(new Set<NavigationGuard>());
  const value = useMemo<Value>(
    () => ({
      navigate: (action) => runGuards([...guards.current], action),
      register: (guard) => {
        guards.current.add(guard);
        return () => guards.current.delete(guard);
      },
    }),
    [],
  );
  // sync: same-origin links anywhere on the page wait for this surface's guards while one is active.
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!guards.current.size || ignoreLinkClick(event)) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || anchor.target || anchor.download || anchor.origin !== location.origin) return;
      if (anchor.hash) return;
      event.preventDefault();
      event.stopPropagation();
      const href = anchor.pathname + anchor.search;
      value.navigate(() => router.push(href));
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [router, value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useEntityNavigation() {
  return useContext(Context).navigate;
}
export function useNavigationGuard(guard: NavigationGuard) {
  const { register } = useContext(Context);
  const latest = useEffectEvent((proceed: () => void) => guard(proceed));
  // sync: one registration per editor; the latest guard body is always the one invoked.
  useEffect(
    () =>
      register((proceed) => {
        void latest(proceed);
      }),
    [register],
  );
}
