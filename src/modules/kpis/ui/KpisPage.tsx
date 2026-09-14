'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  Target,
  TriangleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  CircleHelp,
  Clock,
  CircleSlash,
  Trash2,
} from 'lucide-react';
import { EntityPage } from '@/ui/entity/EntityPage';
import { sortOptions } from '@/ui/entity/filters';
import type { Facet, FiltersDef, View } from '@/ui/entity/types';
import { Sort } from '../schema/validation';
import { useKpis, useKpi, useKpiMutations, useKpiFacets } from './queries';
import { KpiRow, KpiTrail } from './KpiRow';
import { CreateKpi } from './CreateKpi';
const KpiRecord = dynamic(() => import('./KpiRecord').then((module) => module.KpiRecord));
export function KpisPage() {
  const t = useTranslations('kpis');
  const mutations = useKpiMutations();
  const filters = useKpiFilters();
  return (
    <EntityPage
      module="kpis"
      title={t('title')}
      description={t('intro')}
      filters={filters}
      useList={useKpis}
      useDetail={useKpi}
      mutations={mutations}
      emptyState={{ title: t('emptyTitle'), description: t('emptyDescription'), icon: Target }}
      renderers={{
        rowStyle: 'card',
        name: (item) => item.name,
        row: (item) => <KpiRow kpi={item} />,
        rowTrail: (item) => <KpiTrail kpi={item} />,
        detail: (item, api) => <KpiRecord kpi={item} api={api} />,
        create: (api) => <CreateKpi api={api} />,
      }}
    />
  );
}
// KPIS-B07. The strip above the list is the scorecard: how the measures divide today. "Needs
// attention" stays a rail view rather than a tile, because it is the same rows counted twice.
function useKpiFilters(): FiltersDef {
  const t = useTranslations('kpis');
  const facets = useKpiFacets();
  const any = { value: '', label: t('anyValue') };
  const options: Facet[] = [
    {
      key: 'objectiveId',
      label: t('objective'),
      options: [
        any,
        { value: 'none', label: t('noObjective') },
        ...(facets.data?.objectives ?? []).map((row) => ({ value: row.id, label: row.name })),
      ],
    },
    {
      key: 'category',
      label: t('category'),
      options: [any, ...(facets.data?.categories ?? []).map((row) => ({ value: row, label: row }))],
    },
    {
      key: 'team',
      label: t('team'),
      options: [any, ...(facets.data?.teams ?? []).map((row) => ({ value: row, label: row }))],
    },
  ];
  return { views: useKpiViews(), facets: options, sort: sortOptions(Sort.options, t) };
}
function useKpiViews(): View[] {
  const t = useTranslations('kpis');
  return [
    { id: 'attention', label: t('attention'), icon: TriangleAlert },
    { id: 'all', label: t('all'), icon: Target },
    {
      id: 'on_target',
      label: t('on_target'),
      icon: CircleCheck,
      featured: true,
      tone: 'accent',
      featuredOrder: 1,
    },
    {
      id: 'near_target',
      label: t('near_target'),
      icon: CircleDot,
      featured: true,
      featuredOrder: 2,
    },
    {
      id: 'off_target',
      label: t('off_target'),
      icon: CircleX,
      featured: true,
      tone: 'danger',
      featuredOrder: 3,
    },
    { id: 'no_data', label: t('no_data'), icon: CircleHelp, featured: true, featuredOrder: 4 },
    { id: 'stale', label: t('stale'), icon: Clock },
    { id: 'no_target', label: t('no_target'), icon: CircleSlash },
    { id: 'trash', label: t('trash'), icon: Trash2, separated: true },
  ];
}
