'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/ui/layout/Field';
import { Input } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useChangeEmail, useChangePassword } from './queries';
import type { Account } from '../schema/validation';
// ACCT-B06: email and password are explicit forms with a submit rather than fields that save on
// blur. Both have consequences the reader should confirm by acting.
export function AccountSignIn({ account }: { account: Account }) {
  return (
    <div className="grid gap-6">
      <EmailForm account={account} />
      <PasswordForm />
    </div>
  );
}
function EmailForm({ account }: { account: Account }) {
  const t = useTranslations('account');
  const c = useTranslations('common');
  const [email, setEmail] = useState(account.user.email);
  const change = useChangeEmail();
  const dirty = email.trim().toLowerCase() !== account.user.email;
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        change.mutate({ revision: account.user.revision, email: email.trim() });
      }}
    >
      <Field label={t('email')} hint={t('emailHint')}>
        {(control) => (
          <div className="flex items-center gap-2">
            <Input
              {...control}
              type="email"
              inputMode="email"
              dir="ltr"
              spellCheck={false}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" disabled={!dirty || change.isPending}>
              {change.isPending ? c('saving') : c('save')}
            </Button>
          </div>
        )}
      </Field>
      {change.error && <ErrorPanel error={change.error} />}
    </form>
  );
}
function PasswordForm() {
  const t = useTranslations('account');
  const c = useTranslations('common');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const change = useChangePassword();
  const ready = current.length > 0 && next.length >= 12;
  return (
    <form
      className="grid gap-3 border-t pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        change.mutate(
          { current, next },
          {
            onSuccess: () => {
              setCurrent('');
              setNext('');
            },
          },
        );
      }}
    >
      <Field label={t('currentPassword')}>
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        )}
      </Field>
      <Field label={t('newPassword')} hint={t('passwordHint')}>
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        )}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready || change.isPending}>
          {change.isPending ? c('saving') : t('changePassword')}
        </Button>
        {change.isSuccess && (
          <span role="status" className="text-sm text-text-muted">
            {t('passwordChanged', { count: change.data.data.revoked })}
          </span>
        )}
      </div>
      {change.error && <ErrorPanel error={change.error} />}
    </form>
  );
}
