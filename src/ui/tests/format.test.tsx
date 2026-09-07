// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, type DateTimeFormatOptions } from 'next-intl';
import { useCount, usePlainDate } from '../format';
function Sample({ date }: { date: string }) {
  const plainDate = usePlainDate();
  const count = useCount();
  return (
    <p>
      <span data-testid="date">{plainDate(date)}</span>
      <span data-testid="count">{count(1234)}</span>
    </p>
  );
}
function mount(locale: string, numberingSystem: 'arab' | 'latn', timeZone: string) {
  cleanup();
  const day: DateTimeFormatOptions = {
    calendar: 'gregory',
    numberingSystem,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{}}
      timeZone={timeZone}
      formats={{
        dateTime: { day, dateTime: day },
        number: { integer: { numberingSystem, maximumFractionDigits: 0 } },
      }}
    >
      <Sample date="2026-03-01" />
    </NextIntlClientProvider>,
  );
}
describe('formatting hooks', () => {
  it('TASKS-B03 renders Arabic-Indic digits when the numerals preference is arabic', () => {
    mount('ar', 'arab', 'UTC');
    expect(screen.getByTestId('count').textContent).toContain('١');
    expect(screen.getByTestId('date').textContent).toContain('٢٠٢٦');
  });
  it('renders the same calendar day for a plain date under any workspace timezone', () => {
    mount('en', 'latn', 'Pacific/Kiritimati');
    const east = screen.getByTestId('date').textContent;
    mount('en', 'latn', 'Pacific/Pago_Pago');
    expect(screen.getByTestId('date').textContent).toBe(east);
    expect(east).toContain('Mar 1');
  });
});
