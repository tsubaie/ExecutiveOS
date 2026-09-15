import { searchProvider } from './search';
import type { ServerManifest } from '@/core/modules/server-manifest';
export {
  aiPeople,
  assignablePeople,
  createPerson,
  countPeople,
  listPeople,
  getPerson,
  patchPerson,
  removePerson,
  restorePerson,
  personNameSql,
  personForUser,
  userIdsForPeople,
} from './service';
export const server: ServerManifest = { id: 'people', search: searchProvider };
