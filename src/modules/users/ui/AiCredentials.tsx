'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { AiCredentialStatus } from '@/core/config/ai-schema';
import { useAiCredentials, useSaveAiCredentials, useRemoveAiCredentials } from './ai-queries';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
export function AiCredentials() {
  const query = useAiCredentials();
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} />;
  return <CredentialForm status={query.data.data} />;
}
function CredentialForm({ status }: { status: z.infer<typeof AiCredentialStatus> }) {
  const t = useTranslations('admin');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const save = useSaveAiCredentials();
  const remove = useRemoveAiCredentials();
  const busy = save.isPending || remove.isPending;
  return (
    <form
      className="space-y-5 rounded-xl border bg-surface p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        save.mutate(
          { apiKey },
          {
            onSuccess: () => {
              setApiKey('');
              setSaved(true);
              save.reset();
            },
          },
        );
      }}
    >
      <CredentialHeader source={status.source} />
      <CredentialControls
        status={status}
        busy={busy}
        apiKey={apiKey}
        onKey={(value) => {
          setApiKey(value);
          setSaved(false);
        }}
        onRemove={() => {
          setSaved(false);
          remove.mutate();
        }}
      />
      {saved && (
        <p role="status" className="text-sm font-medium text-success">
          {t('aiKeySaveSuccess')}
        </p>
      )}
      {save.error && <ErrorPanel error={save.error} />}
      {remove.error && <ErrorPanel error={remove.error} />}
    </form>
  );
}
function CredentialHeader({ source }: { source: z.infer<typeof AiCredentialStatus>['source'] }) {
  const t = useTranslations('admin');
  const configured = source !== 'none';
  return (
    <>
      <div className="flex items-start gap-3">
        {configured ? (
          <CheckCircle2 className="mt-1 size-6 shrink-0 text-success" />
        ) : (
          <KeyRound className="mt-1 size-6 shrink-0 text-text-muted" />
        )}
        <div className="space-y-1">
          <h2 className="font-medium">{t('aiCredentials')}</h2>
          <p
            role="status"
            className={configured ? 'text-sm font-medium text-success' : 'text-sm text-text-muted'}
          >
            {source === 'saved'
              ? t('aiKeySaved')
              : source === 'environment'
                ? t('aiKeyEnvironment')
                : t('aiKeyMissing')}
          </p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-text-muted">{t('aiStorageHelp')}</p>
    </>
  );
}

function CredentialControls({
  status,
  busy,
  apiKey,
  onKey,
  onRemove,
}: {
  status: z.infer<typeof AiCredentialStatus>;
  busy: boolean;
  apiKey: string;
  onKey: (value: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('admin');
  return (
    <>
      <Field label={status.source === 'saved' ? t('aiReplacementKey') : t('aiApiKey')}>
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={apiKey}
            required
            maxLength={4096}
            disabled={busy}
            onChange={(event) => {
              onKey(event.target.value);
            }}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !apiKey.trim()}>
          {status.source === 'saved' ? t('aiReplaceKey') : t('aiSaveKey')}
        </Button>
        {status.source === 'saved' && (
          <Button type="button" variant="outline" disabled={busy} onClick={onRemove}>
            {t('aiRemoveKey')}
          </Button>
        )}
      </div>
    </>
  );
}
