'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Setting } from '../schema/validation';
import { useSettings, useSaveSetting } from './queries';
import { Input } from '@/ui/primitives/input';
import { Textarea } from '@/ui/primitives/textarea';
import { Button } from '@/ui/primitives/button';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
// A structured default gets a textarea for its JSON, everything else a single-line input.
function SettingInput({
  setting,
  value,
  setValue,
}: {
  setting: z.infer<typeof Setting>;
  value: string;
  setValue: (value: string) => void;
}) {
  const structured = typeof setting.default === 'object' && setting.default !== null;
  return (
    <Field label={setting.key}>
      {(control) =>
        structured ? (
          <Textarea
            {...control}
            dir="auto"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <Input {...control} dir="auto" value={value} onChange={(e) => setValue(e.target.value)} />
        )
      }
    </Field>
  );
}
function SettingControl({ setting }: { setting: z.infer<typeof Setting> }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const [value, setValue] = useState(
    typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value),
  );
  const mutation = useSaveSetting();
  const [error, setError] = useState<Error | null>(null);
  function save() {
    try {
      const parsed =
        typeof setting.default === 'string' ? value : z.json().parse(JSON.parse(value));
      mutation.mutate({ key: setting.key, value: parsed });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    }
  }
  return (
    <div className="grid gap-3 border-b py-5">
      <SettingInput setting={setting} value={value} setValue={setValue} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={save} disabled={mutation.isPending}>
          {c('save')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setValue(
              typeof setting.default === 'string'
                ? setting.default
                : JSON.stringify(setting.default),
            );
            mutation.mutate({ key: setting.key, value: setting.default });
          }}
        >
          {t('reset')}
        </Button>
      </div>
      {error && <ErrorPanel error={error} />}{' '}
      {mutation.isError && <ErrorPanel error={mutation.error} />}{' '}
      {mutation.isSuccess && (
        <p role="status" className="text-xs text-success">
          {c('saved')}
        </p>
      )}
    </div>
  );
}
export function SettingsPage() {
  const t = useTranslations('admin');
  const query = useSettings();
  return (
    <div className="max-w-2xl">
      <p className="mb-2 text-sm text-text-muted">{t('settingsDescription')}</p>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} />
      ) : (
        query.data.data.map((setting) => <SettingControl key={setting.key} setting={setting} />)
      )}
    </div>
  );
}
