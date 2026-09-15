'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { routes } from '@/core/routes';
import Loading from '@/ui/layout/Loading';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useAccount } from './queries';
import { AccountIdentity } from './AccountIdentity';
import { AccountSignIn } from './AccountSignIn';
import { AccountSessions } from './AccountSessions';
import { AccountPreferences } from './AccountPreferences';
// ACCT-B08: one record and no list, so this is a plain settings page rather than an entity page.
// It takes Administration's section shape so that the reader's own settings and the workspace's
// read the same way.
export function AccountPage() {
  const t = useTranslations('account');
  const c = useTranslations('common');
  const account = useAccount();
  if (account.isPending) return <Loading />;
  if (account.error) return <ErrorPanel error={account.error} />;
  const data = account.data.data;
  return (
    <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
      <p className="mb-3 text-sm text-accent">{c('account')}</p>
      <h1 className="mb-8 text-2xl font-semibold">
        <bdi>{data.user.name}</bdi>
      </h1>
      <Section title={t('identity')}>
        <AccountIdentity account={data} />
      </Section>
      <Section title={t('signIn')}>
        <AccountSignIn account={data} />
      </Section>
      <Section title={t('sessions')} description={t('sessionsDescription')}>
        <AccountSessions account={data} />
      </Section>
      <Section title={t('preferences')} description={t('preferencesDescription')}>
        <AccountPreferences account={data} />
      </Section>
      {/* ACCT-B07: the workspace's own settings are Administration's, and saying so here is what
          stops a reader hunting for them on the page that holds everything else. */}
      <p className="mt-10 border-t pt-5 text-sm text-text-muted">
        {t('workspaceElsewhere')}{' '}
        <Link href={routes.admin('settings')} className="text-accent underline-offset-4 hover:underline">
          {c('admin')}
        </Link>
      </p>
    </div>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-1 text-base font-medium">{title}</h2>
      {description && <p className="mb-4 text-sm text-text-muted">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}
