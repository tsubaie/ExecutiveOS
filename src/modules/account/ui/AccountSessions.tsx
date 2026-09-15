'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTime } from '@/ui/format';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useRevokeSession, useSignOutOthers } from './queries';
import type { Account } from '../schema/validation';
// ACCT-B03: the reader's own sessions, with this one marked. A user agent is an opaque identifier
// and never translated (05 § i18n).
export function AccountSessions({ account }: { account: Account }) {
  const t = useTranslations('account');
  const c = useTranslations('common');
  const revoke = useRevokeSession();
  const others = useSignOutOthers();
  const [confirming, setConfirming] = useState(false);
  const rest = account.sessions.filter((session) => !session.current);
  return (
    <div className="grid gap-2">
      {account.sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          disabled={revoke.isPending}
          onRevoke={() => revoke.mutate(session.id)}
        />
      ))}
      {rest.length === 0 ? (
        <p className="text-sm text-text-muted">{t('noOtherSessions')}</p>
      ) : (
        <div>
          <Button variant="outline" disabled={others.isPending} onClick={() => setConfirming(true)}>
            {t('signOutOthers')}
          </Button>
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent>
              <DialogTitle>{t('signOutOthers')}</DialogTitle>
              <DialogDescription>{t('signOutOthersConfirm')}</DialogDescription>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  {c('cancel')}
                </Button>
                <Button
                  onClick={() => {
                    setConfirming(false);
                    others.mutate(undefined);
                  }}
                >
                  {c('confirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {revoke.error && <ErrorPanel error={revoke.error} />}
      {others.error && <ErrorPanel error={others.error} />}
    </div>
  );
}
// One signed-in device. The user agent is an opaque identifier: never translated, always LTR.
function SessionRow({
  session,
  disabled,
  onRevoke,
}: {
  session: Account['sessions'][number];
  disabled: boolean;
  onRevoke: () => void;
}) {
  const t = useTranslations('account');
  const when = useDateTime();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
      {/* A session's own id says nothing to the reader; where there is no user agent and no
          address to name the device by, say that rather than printing a UUID at them. */}
      <span className="min-w-0 flex-1 truncate" translate="no" dir="ltr">
        {session.userAgent ?? session.ip ?? t('unknownDevice')}
      </span>
      {session.current && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
          {t('currentSession')}
        </span>
      )}
      <span className="text-xs text-text-muted" title={session.lastSeenAt}>
        {t('lastSeen')} {when(session.lastSeenAt)}
      </span>
      {!session.current && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onRevoke}>
          {t('revoke')}
        </Button>
      )}
    </div>
  );
}
