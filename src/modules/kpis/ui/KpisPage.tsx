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
import { KpiCard } from './KpiCard';
import { CreateKpi } from './CreateKpi';
import { useKpiColumns } from './KpiColumns';
import { usePrefetch } from '@/ui/entity/use-prefetch';
const importRecord = () => import('./KpiRecord');
const KpiRecord = dynamic(() => importRecord().then((module) => module.KpiRecord));
export function KpisPage() {
  const t = useTranslations('kpis');
  const mutations = useKpiMutations();
  const columns = useKpiColumns();
  usePrefetch(importRecord);
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
      group={(item) =>
        item.objectiveName
          ? item.objectiveDeleted
            ? t('archivedObjective', { name: item.objectiveName })
            : item.objectiveName
          : t('noObjective')
      }
      renderers={{
        rowStyle: 'grid',
        columns,
        name: (item) => item.name,
        row: (item) => <KpiCard kpi={item} />,
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
      key: 'ownerId',
      label: t('owner'),
      options: [
        any,
        { value: 'none', label: t('noOwner') },
        ...(facets.data?.owners ?? []).map((row) => ({ value: row.id, label: row.name })),
      ],
    },
  ];
  return {
    views: useKpiViews(),
    facets: options,
    sort: sortOptions(Sort.options, t),
    mode: {
      label: t('measuredAgainst'),
      key: 'period',
      options: [
        { id: 'previous', label: t('comparePrevious') },
        { id: '', label: t('compareCurrent') },
        { id: 'next', label: t('compareNext') },
      ],
    },
  };
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
