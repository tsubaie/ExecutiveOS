import type { ServerManifest } from '@/core/modules/server-manifest';
import { homeSummary } from './service';
export { getKpi, getKpiDetail, listObjectives, homeSummary } from './service';
export const server: ServerManifest = { id: 'kpis', homeSummary };
