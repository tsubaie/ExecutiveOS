'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EntityCreateForm } from '@/ui/entity/EntityCreateForm';
import type { CreateApi } from '@/ui/entity/types';
import { KpiCreate, type Kpi } from '../schema/validation';
import { KpiFields, NO_OBJECTIVE, NO_OWNER } from './KpiFields';
const blank: KpiCreate = {
  name: '',
  unit: 'count',
  direction: 'higher',
  frequency: 'quarterly',
  category: '',
  objectiveId: null,
  ownerId: null,
  notes: '',
};
export function CreateKpi({ api }: { api: CreateApi<KpiCreate, Kpi> }) {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  async function submit(form: FormData) {
    setError(null);
    const text = (key: string) => String(form.get(key) ?? '');
    try {
      await api.submit(
        KpiCreate.parse({
          name: text('name'),
          unit: text('unit'),
          direction: text('direction'),
          frequency: text('frequency'),
          category: text('category'),
          objectiveId: text('objectiveId') === NO_OBJECTIVE ? null : text('objectiveId'),
          ownerId: text('ownerId') === NO_OWNER ? null : text('ownerId'),
          notes: text('notes'),
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(c('error')));
    }
  }
  return (
    <EntityCreateForm
      title={t('newKpi')}
      pending={api.pending}
      error={error}
      cancel={api.cancel}
      onSubmit={submit}
    >
      <KpiFields initial={blank} />
    </EntityCreateForm>
  );
}
