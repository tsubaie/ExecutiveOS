// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { PersonAvatar } from '@/ui/layout/PersonAvatar';
import { Button } from '@/ui/primitives/button';
import { seedPeople } from '../../../../tests/fixtures/people';
const person = seedPeople[4]?.fullName ?? '';
const rowTitle = 'Prepare the annual report';
// The row shape the framework renders: a button carrying `renderers.row`, with the leading and
// trailing slots as its siblings inside the row container (EntityList.tsx).
function Row({ trail }: { trail?: boolean }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
    >
      <div className="entity-row" data-testid="row">
        <Button data-row-id="task-1">{rowTitle}</Button>
        {trail && (
          <div data-testid="trail">
            <PersonAvatar name={person} />
          </div>
        )}
      </div>
    </NextIntlClientProvider>
  );
}
describe('entity row trailing slot', () => {
  afterEach(cleanup);
  it('EP-B20 the trailing control is a sibling of the row button, never nested inside it', () => {
    render(<Row trail />);
    const rowButton = screen.getByRole('button', { name: rowTitle });
    const trigger = screen.getByRole('button', { name: `Show ${person}` });
    expect(rowButton.contains(trigger)).toBe(false);
    expect(trigger.closest('button')).toBe(trigger);
    expect(screen.getByTestId('row').contains(trigger)).toBe(true);
  });
  it('EP-B20 the slot adds no markup when the module supplies no trailing renderer', () => {
    render(<Row />);
    expect(screen.queryByTestId('trail')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
