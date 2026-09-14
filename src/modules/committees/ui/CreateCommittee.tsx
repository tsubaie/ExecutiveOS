'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EntityCreateForm } from '@/ui/entity/EntityCreateForm';
import type { CreateApi } from '@/ui/entity/types';
import { ApiError } from '@/core/http/client';
import { CommitteeCreate, type Committee } from '../schema/validation';
import { CommitteeFields } from './CommitteeFields';
export function CreateCommittee({ api }: { api: CreateApi<CommitteeCreate, Committee> }) {
  const t = useTranslations('committees');
  const c = useTranslations('common');
  const [error, setError] = useState<Error | null>(null);
  async function submit(form: FormData) {
    setError(null);
    try { await api.submit(CommitteeCreate.parse(Object.fromEntries(form))); }
    catch (failure) { setError(failure instanceof Error ? failure : new Error(c('error'))); }
  }
  return <EntityCreateForm title={t('newCommittee')} pending={api.pending} error={error} cancel={api.cancel} onSubmit={submit}>
    <CommitteeFields initial={{ name: '', description: '', ownership: '', scope: 'internal', status: 'active' }}
      nameError={error instanceof ApiError && error.code === 'conflict' ? t('duplicateName') : undefined} />
  </EntityCreateForm>;
}
