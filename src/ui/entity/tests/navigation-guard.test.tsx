// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EntityNavigationProvider, useEntityNavigation, useNavigationGuard } from '../navigation';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const wrapper = ({ children }: { children: ReactNode }) => (
  <EntityNavigationProvider>{children}</EntityNavigationProvider>
);
describe('entity navigation guards', () => {
  it('EP-B11 a registered guard defers navigation until it proceeds', async () => {
    let release: (() => void) | undefined;
    const action = vi.fn();
    const { result } = renderHook(
      () => {
        useNavigationGuard((proceed) => {
          release = proceed;
        });
        return useEntityNavigation();
      },
      { wrapper },
    );
    act(() => result.current(action));
    await Promise.resolve();
    expect(action).not.toHaveBeenCalled();
    act(() => release?.());
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('EP-B11 a surface with no guard navigates immediately and a declined guard blocks', async () => {
    const immediate = vi.fn();
    const { result } = renderHook(() => useEntityNavigation(), { wrapper });
    act(() => result.current(immediate));
    expect(immediate).toHaveBeenCalledTimes(1);
    const blocked = vi.fn();
    const declined = renderHook(
      () => {
        useNavigationGuard(() => undefined);
        return useEntityNavigation();
      },
      { wrapper },
    );
    act(() => declined.result.current(blocked));
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
  });
  it('EP-B11 guards unregister with their owner', async () => {
    const action = vi.fn();
    const { result, unmount } = renderHook(
      () => {
        useNavigationGuard(() => undefined);
        return useEntityNavigation();
      },
      { wrapper },
    );
    const navigate = result.current;
    unmount();
    act(() => navigate(action));
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
