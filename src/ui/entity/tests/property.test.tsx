// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Property } from '@/ui/layout/Property';
import { Field } from '@/ui/layout/Field';
// The lint rule that keeps user-visible text in the catalog applies here too, so the sample
// values come through identifiers rather than sitting in the markup.
const sample = { value: 'value', blank: 'blank', set: 'Audit Committee', unset: 'No committee' };
afterEach(cleanup);
// EP-B25: the stylesheet decides what read-first looks like; what the component has to get right
// is which rows are being read and which hold nothing, because those are the two facts the CSS
// keys off and the two a create form must not inherit.
it('EP-B25 a panel row is read-first and a create row is not', () => {
  render(
    <>
      <Property label="Read" quiet>
        <span>{sample.value}</span>
      </Property>
      <Property label="Fill in">
        <span>{sample.blank}</span>
      </Property>
    </>,
  );
  expect(screen.getByText('Read').parentElement?.className).toContain('property-quiet');
  expect(screen.getByText('Fill in').parentElement?.className).not.toContain('property-quiet');
});
it('EP-B25 a value nobody has set is marked so it can recede', () => {
  render(
    <>
      <Property label="Set" quiet empty={false}>
        <span>{sample.set}</span>
      </Property>
      <Property label="Unset" quiet empty>
        <span>{sample.unset}</span>
      </Property>
    </>,
  );
  expect(screen.getByText('Set').parentElement?.className).not.toContain('property-empty');
  expect(screen.getByText('Unset').parentElement?.className).toContain('property-empty');
});

it('EP-B25 a field carries the same signals as a property row, and keeps its identifiers', () => {
  const problem = 'Enter an address';
  render(
    <Field label="Email" error={problem} quiet row>
      {(control) => <input {...control} readOnly value={sample.blank} />}
    </Field>,
  );
  const row = screen.getByText('Email').parentElement;
  expect(row?.className).toContain('property-quiet');
  // EP-B19 still holds: the control names its own error, and the error is announced.
  const control = screen.getByRole('textbox');
  const error = screen.getByRole('alert');
  expect(control.getAttribute('aria-errormessage')).toBe(error.id);
  expect(control.getAttribute('aria-invalid')).toBe('true');
  // The message sits with the control, not out in the label column.
  expect(control.parentElement?.contains(error)).toBe(true);
});
