// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { ToastHost } from '@/ui/layout/toast/ToastHost';
import { EntityNavigationProvider } from '@/ui/entity/navigation';
import { EntityPanel } from '@/ui/entity/EntityPanel';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
const person = {
  id: '01a0a000-0000-7000-8000-000000000001',
  revision: 3,
  deletedAt: null,
  deletedOpId: null,
};
const opId = '01a0a000-0000-7000-8000-0000000000aa';
function mount(mutations: Parameters<typeof EntityPanel>[0]['mutations']) {
  const close = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastHost>
        <EntityNavigationProvider>
          <EntityPanel
            item={person}
            name="Leila Haddad"
            deletedMessage={en.people.deletedToast}
            mutations={mutations}
            render={(_item, api) => (
              <button type="button" onClick={api.remove}>
                {en.common.delete}
              </button>
            )}
            reload={vi.fn().mockResolvedValue(person)}
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
const adapters = (remove = vi.fn().mockResolvedValue({ opId })) => ({
  patch: vi.fn(),
  create: vi.fn(),
  remove,
  restore: vi.fn().mockResolvedValue(person),
});
const press = (name: string) => screen.getAllByRole('button', { name })[0]?.click();
it('PEOPLE-B07 deleting a person asks nothing, closes the panel and offers Undo', async () => {
  const mutations = adapters();
  const close = mount(mutations);
  press(en.common.delete);
  await waitFor(() => expect(mutations.remove).toHaveBeenCalledWith(person.id, person.revision));
  // No confirmation stands in front of a reversible action. (The toast is itself a `dialog`
  // landmark so a screen reader can navigate into it, so the assertion names the app's own
  // dialog surface rather than the role.)
  expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
  await waitFor(() => expect(close).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(en.people.deletedToast)).toBeTruthy());
});
it('PEOPLE-B07 Undo restores through the deletion operation rather than delaying the delete', async () => {
  const mutations = adapters();
  mount(mutations);
  press(en.common.delete);
  await waitFor(() => expect(screen.getByText(en.people.deletedToast)).toBeTruthy());
  press(en.common.undo);
  await waitFor(() => expect(mutations.restore).toHaveBeenCalledWith(person.id, opId));
});
it('PEOPLE-B07 a delete that fails leaves the panel open and the person where they were', async () => {
  const mutations = adapters(vi.fn().mockRejectedValue(new Error('nope')));
  const close = mount(mutations);
  press(en.common.delete);
  await waitFor(() => expect(mutations.remove).toHaveBeenCalled());
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByText(en.people.deletedToast)).toBeNull();
});
