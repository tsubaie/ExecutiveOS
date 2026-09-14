'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { AiModels as Models } from '@/core/config/ai-model-schema';
import { useAiModels, useSaveAiModels, useAiCredentials } from './ai-queries';
import { Button } from '@/ui/primitives/button';
import { AiModelPicker } from './AiModelPicker';
import { supportsModelSlot } from '@/core/config/ai-model-schema';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
export function AiModels() {
  const t = useTranslations('admin');
  const credentials = useAiCredentials();
  const configured = credentials.data?.data.source !== 'none' && !!credentials.data;
  const query = useAiModels(configured);
  return (
    <section className="space-y-4 rounded-xl border bg-surface p-6">
      <h2 className="font-medium">{t('aiModels')}</h2>
      <p className="text-sm text-text-muted">{t('aiModelsHelp')}</p>
      {configured && <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('aiRefreshModels')}</Button>}
      {!configured ? <p className="text-sm text-text-muted">{t('aiSaveKeyFirst')}</p> : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ModelForm
          data={query.data.data}
        />
      )}
    </section>
  );
}
function ModelForm({ data }: { data: z.infer<typeof Models> }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const [defaultModel, setDefaultModel] = useState(data.defaultModel);
  const [fastModel, setFastModel] = useState(data.fastModel);
  const save = useSaveAiModels();
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ defaultModel, fastModel });
      }}
    >
      <AiModelPicker
        models={data.models.filter((model) => supportsModelSlot(model, 'default'))}
        value={defaultModel}
        setValue={setDefaultModel}
        label={t('aiDefaultModel')}
      />
      <AiModelPicker models={data.models.filter((model) => supportsModelSlot(model, 'fast'))} value={fastModel} setValue={setFastModel} label={t('aiFastModel')} />
      <Button type="submit" disabled={save.isPending || !data.models.some((model) => model.id === defaultModel && supportsModelSlot(model, 'default')) || !data.models.some((model) => model.id === fastModel && supportsModelSlot(model, 'fast'))}>
        {c('save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-success">
          {c('saved')}
        </p>
      )}
      {save.error && <ErrorPanel error={save.error} />}
    </form>
  );
}
