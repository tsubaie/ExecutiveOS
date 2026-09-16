// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { AiUnavailable } from '@/ui/ai/AiUnavailable';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
const show = (state: { configured: boolean; canConfigure: boolean }) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AiUnavailable
        review={{
          capability: 'notes.refine',
          checkingAvailability: false,
          recheckAvailability: vi.fn(),
          ...state,
        }}
      />
    </NextIntlClientProvider>,
  );
it('ADMIN-B29 a workspace that never set AI up says nothing to a reader who cannot turn it on', () => {
  const { container } = show({ configured: false, canConfigure: false });
  // Not a fault, and not this reader's to fix: on every record, forever, it is only noise.
  expect(container.textContent).toBe('');
});
it('ADMIN-B29 the reader who can turn it on is invited to, and is not asked to check a setting nobody changed', () => {
  show({ configured: false, canConfigure: true });
  expect(screen.getByText(en.ai.off)).toBeTruthy();
  expect(screen.queryByRole('button', { name: en.ai.checkAvailability })).toBeNull();
});
it('ADMIN-B29 an outage reaches everyone, because a member lost a control they had yesterday', () => {
  show({ configured: true, canConfigure: false });
  expect(screen.getByText(en.ai.unavailable)).toBeTruthy();
  // Checking again can change the answer here, unlike a workspace that never set AI up.
  expect(screen.getByRole('button', { name: en.ai.checkAvailability })).toBeTruthy();
});
it('ADMIN-B29 the detail explains what this record loses, and offers the fix only to whoever has it', () => {
  show({ configured: true, canConfigure: false });
  expect(screen.getByRole('button', { name: en.ai.unavailableDetails })).toBeTruthy();
  expect(screen.queryByText(en.ai.turnOn)).toBeNull();
});
