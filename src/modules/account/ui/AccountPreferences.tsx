'use client';
import { useTranslations } from 'next-intl';
import { ChoiceSelect } from '@/ui/layout/ChoiceSelect';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { usePatchAccount } from './queries';
import type { Account } from '../schema/validation';
// ACCT-I03: "" is "follow the workspace" and clears the reader's row rather than copying today's
// value, so a later change to the workspace default still reaches them. Each control names its own
// patch key, which is what lets the compiler check the value against that key's own union instead
// of a cast standing in for the check.
export function AccountPreferences({ account }: { account: Account }) {
  const t = useTranslations('account');
  const patch = usePatchAccount();
  const revision = account.user.revision;
  const set = account.preferences.explicit;
  // Both go through the same generic so every value keeps its literal type: "" for the inherited
  // option and the key's own union for the rest, which is what the control is then checked against.
  const option = <V extends string>(value: V, label: string) => ({ value, label, text: label });
  const inherit = () => option('', t('workspaceDefault'));
  return (
    <div className="grid gap-4">
      <Field label={t('theme')}>
        {() => (
          <ChoiceSelect
            label={t('theme')}
            value={set.includes('theme') ? account.preferences.theme : ''}
            items={[inherit(), option('dark', t('dark')), option('light', t('light'))]}
            onChange={(theme) => patch.mutate({ revision, theme })}
          />
        )}
      </Field>
      <Field label={t('locale')}>
        {() => (
          <ChoiceSelect
            label={t('locale')}
            value={set.includes('locale') ? account.preferences.locale : ''}
            items={[inherit(), option('en', t('english')), option('ar', t('arabic'))]}
            onChange={(locale) => patch.mutate({ revision, locale })}
          />
        )}
      </Field>
      <Field label={t('numerals')}>
        {() => (
          <ChoiceSelect
            label={t('numerals')}
            value={set.includes('numerals') ? account.preferences.numerals : ''}
            items={[
              inherit(),
              option('western', t('western')),
              option('arabic', t('arabicNumerals')),
            ]}
            onChange={(numerals) => patch.mutate({ revision, numerals })}
          />
        )}
      </Field>
      {patch.error && <ErrorPanel error={patch.error} />}
    </div>
  );
}
