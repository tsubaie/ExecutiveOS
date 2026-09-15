import { searchProvider } from './search';
import type { ServerManifest } from '@/core/modules/server-manifest';
import { homeSummary } from './service';
export {
  getKpi,
  getKpiDetail,
  listKpis,
  createKpi,
  addReading,
  putTargets,
  listObjectives,
  createObjective,
  homeSummary,
} from './service';
export const server: ServerManifest = { id: 'kpis', homeSummary, search: searchProvider };
