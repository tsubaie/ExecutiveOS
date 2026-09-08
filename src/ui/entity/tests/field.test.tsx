// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { Field } from '@/ui/layout/Field';
import { Input } from '@/ui/primitives/input';
const labels = { email: 'Email address', name: 'Full name' };
const submitLabel = 'Save';
const messages = { hint: 'Use your work address.', invalid: 'Enter an email address.' };
function StaticField({ error, hint }: { error?: string; hint?: string }) {
  return (
    <Field label={labels.email} error={error} hint={hint}>
      {(control) => <Input {...control} defaultValue="" />}
    </Field>
  );
}
function SubmittedForm() {
  const form = useForm({ defaultValues: { name: '', email: '' } });
  return (
    <form onSubmit={form.handleSubmit(() => undefined)}>
      <Field label={labels.name}>
        {(control) => <Input {...control} {...form.register('name')} />}
      </Field>
      <Field label={labels.email} error={form.formState.errors.email?.message}>
        {(control) => (
          <Input {...control} {...form.register('email', { required: messages.invalid })} />
        )}
      </Field>
      <button type="submit">{submitLabel}</button>
    </form>
  );
}
describe('shared field', () => {
  afterEach(cleanup);
  it('EP-B19 the label points at the control and a hint is announced with it', () => {
    render(<StaticField hint={messages.hint} />);
    const control = screen.getByLabelText(labels.email);
    const described = control.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described ?? '')?.textContent).toBe(messages.hint);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(control.hasAttribute('aria-errormessage')).toBe(false);
  });
  it('EP-B19 an error marks the control invalid and is referenced as its error message', () => {
    render(<StaticField error={messages.invalid} hint={messages.hint} />);
    const control = screen.getByLabelText(labels.email);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    const errorId = control.getAttribute('aria-errormessage');
    const error = document.getElementById(errorId ?? '');
    expect(error?.textContent).toBe(messages.invalid);
    expect(error?.getAttribute('role')).toBe('alert');
    expect(control.getAttribute('aria-describedby')).not.toBe(errorId);
  });
  it('EP-B19 submitting an invalid form focuses the first invalid field', async () => {
    render(<SubmittedForm />);
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    const email = screen.getByLabelText(labels.email);
    await waitFor(() => expect(email.getAttribute('aria-invalid')).toBe('true'));
    expect(document.activeElement).toBe(email);
  });
});
