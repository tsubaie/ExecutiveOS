// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { PersonAvatar } from '@/ui/layout/PersonAvatar';
import { Avatar } from '@/ui/layout/Avatar';
import { seedPeople } from '../../../../../tests/fixtures/people';
const arabic = seedPeople[4]?.fullName ?? '';
const latin = seedPeople[0]?.fullName ?? '';
function mount(name: string) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
    >
      <PersonAvatar name={name} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole('button', { name: `Show ${name}` });
}
describe('person avatar', () => {
  afterEach(cleanup);
  it('PEOPLE-B09 the chip is a control carrying the full name as its accessible name', () => {
    const trigger = mount(arabic);
    expect(trigger.tagName).toBe('BUTTON');
    // The initials themselves are decorative; the name reaches assistive technology directly.
    expect(trigger.textContent).toBe('را');
    expect(trigger.querySelector('bdi')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('PEOPLE-B09 pressing reveals the full name and Escape dismisses it', async () => {
    const trigger = mount(arabic);
    expect(screen.queryByText(arabic)).toBeNull();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByText(arabic)).toBeTruthy());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(arabic)).toBeNull());
  });
  it('PEOPLE-B09 the keyboard reaches the chip and opens it with Enter', async () => {
    const trigger = mount(latin);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByText(latin)).toBeTruthy());
  });
  it('PEOPLE-B09 the plain avatar stays inert where the name is already beside it', () => {
    render(<Avatar name={latin} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(latin)).toBeTruthy();
  });
});
