// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { ToastHost } from '@/ui/layout/toast/ToastHost';
import { EntityNavigationProvider } from '../navigation';
import { EntityPanel } from '../EntityPanel';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
const item = { id: '01a0a000-0000-7000-8000-000000000003', revision: 1, deletedAt: null, deletedOpId: null };
function mount() {
  const close = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastHost>
        <EntityNavigationProvider>
          <EntityPanel
            item={item}
            name="Review the Q4 board pack"
            deletedMessage={en.tasks.deletedToast}
            mutations={{ patch: vi.fn(), create: vi.fn(), remove: vi.fn(), restore: vi.fn() }}
            render={() => null}
            reload={vi.fn().mockResolvedValue(item)}
            close={close}
            move={vi.fn()}
            neighbors={{ previous: false, next: false, position: 1, count: 1 }}
          />
        </EntityNavigationProvider>
      </ToastHost>
    </NextIntlClientProvider>,
  );
  return close;
}
it('EP-B38 the record offers a labelled way back and a cross, and both leave it', async () => {
  const close = mount();
  const back = screen.getByRole('button', { name: en.common.back });
  const cross = screen.getByRole('button', { name: en.common.close });
  // Distinct accessible names for one action, so nothing is announced twice under one label.
  expect(back).not.toBe(cross);
  // Leaving settles pending saves first (EP-B11), so both exits land a tick later rather than
  // on the press.
  back.click();
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  cross.click();
  await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
});
it('EP-B38 the way back is at the start edge and the cross at the end', () => {
  mount();
  const bar = screen.getByRole('button', { name: en.common.back }).parentElement;
  const controls = [...(bar?.querySelectorAll('button') ?? [])];
  const back = controls.findIndex((el) => el.textContent?.includes(en.common.back));
  const cross = controls.findIndex((el) => el.getAttribute('aria-label') === en.common.close);
  // Document order is the logical order, which is what makes the RTL mirror free.
  expect(back).toBeLessThan(cross);
});
