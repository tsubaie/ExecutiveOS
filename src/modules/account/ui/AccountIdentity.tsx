'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/core/routes';
import { Field } from '@/ui/layout/Field';
import { Input } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { usePatchAccount } from './queries';
import type { Account } from '../schema/validation';
// ACCT-B05: the linked person is shown and not edited. It is the directory identity (ADR 0011)
// and it is what work is assigned to, so a reader with none is told why nothing can reach them.
export function AccountIdentity({ account }: { account: Account }) {
  const t = useTranslations('account');
  const c = useTranslations('common');
  const [name, setName] = useState(account.user.name);
  const patch = usePatchAccount();
  const dirty = name.trim() !== account.user.name && name.trim().length > 0;
  return (
    <div className="grid gap-4">
      <Field label={t('name')}>
        {(control) => (
          <div className="flex items-center gap-2">
            <Input
              {...control}
              value={name}
              dir="auto"
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              disabled={!dirty || patch.isPending}
              onClick={() => patch.mutate({ revision: account.user.revision, name: name.trim() })}
            >
              {patch.isPending ? c('saving') : c('save')}
            </Button>
          </div>
        )}
      </Field>
      {patch.error && <ErrorPanel error={patch.error} />}
      <div className="grid gap-1 border-t pt-4 text-sm">
        <span className="text-text-muted">{t('linkedPerson')}</span>
        {account.person ? (
          <Link
            href={routes.person(account.person.id)}
            className="text-accent underline-offset-4 hover:underline"
          >
            <bdi>{account.person.fullName}</bdi>
          </Link>
        ) : (
          <span className="text-text-muted">{t('noLinkedPerson')}</span>
        )}
      </div>
    </div>
  );
}
