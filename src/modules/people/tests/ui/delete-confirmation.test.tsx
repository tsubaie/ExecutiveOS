// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { DeleteEntityDialog } from '@/ui/entity/EntityDialogs';
const person = 'Leila Haddad';
function mount(remove: () => Promise<void>) {
  cleanup();
  const setOpen = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
    >
      <DeleteEntityDialog open setOpen={setOpen} name={person} remove={remove} />
    </NextIntlClientProvider>,
  );
  return setOpen;
}
const confirm = () => screen.getByRole('button', { name: en.common.delete });
describe('person delete confirmation', () => {
  it('PEOPLE-B07 the dialog names the person before anything is removed', () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    mount(remove);
    expect(screen.getByText(`Move ${person} to trash? You can restore them later.`)).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });
  it('PEOPLE-B07 cancelling closes the dialog and leaves the person untouched', () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const setOpen = mount(remove);
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(remove).not.toHaveBeenCalled();
  });
  it('PEOPLE-B07 one confirmation sends one removal even when the button is pressed twice', async () => {
    let release = () => {};
    const remove = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    mount(remove);
    fireEvent.click(confirm());
    await waitFor(() => expect(confirm().hasAttribute('disabled')).toBe(true));
    fireEvent.click(confirm());
    expect(remove).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(confirm().hasAttribute('disabled')).toBe(false));
  });
});
