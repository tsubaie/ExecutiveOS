import type { ServerManifest } from '@/core/modules/server-manifest';
export {
  createPerson,
  countPeople,
  listPeople,
  getPerson,
  patchPerson,
  removePerson,
  restorePerson,
  personNameSql,
} from './service';
export const server: ServerManifest = { id: 'people' };
