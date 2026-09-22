import { describe, expect, it } from 'vitest';
import { isTransactional } from '@/core/db/transaction';
import * as account from '@/modules/account/service';
import * as committees from '@/modules/committees/service';
import * as kpis from '@/modules/kpis/service';
import * as notes from '@/modules/notes/service';
import * as notifications from '@/modules/notifications/service';
import * as people from '@/modules/people/service';
import * as settings from '@/modules/settings/service';
import * as tasks from '@/modules/tasks/service';
import * as users from '@/modules/users/service';
// Exports that only read, or that open their transaction themselves (setup takes a handle, and
// manageTags predates the wrapper). Everything else a service exports writes and must be atomic.
const exempt: Record<string, string[]> = {
  account: ['getAccount'],
  committees: [
    'listCommittees',
    'getCommittee',
    'requireCommittee',
    'committeeChoices',
    'activity',
    'homeSummary',
  ],
  kpis: [
    'listKpis',
    'kpiFacets',
    'getKpi',
    'getKpiDetail',
    'listObjectives',
    'getObjective',
    'listReadings',
    'listTargets',
    'toKpi',
    'keyOf',
  ],
  notes: [
    'viewsFor',
    'peopleForAi',
    'noteTypes',
    'listNotes',
    'getNote',
    'listTypes',
    'noteTemplates',
    'listTemplates',
    'listTags',
    'homeSummary',
    'listManagedTags',
    'manageTags',
  ],
  notifications: ['feed'],
  people: [
    'personNameSql',
    'assignablePeople',
    'listPeople',
    'countPeople',
    'getPerson',
    'aiPeople',
    'personForUser',
    'userIdsForPeople',
  ],
  settings: ['listSettings'],
  tasks: ['listTasks', 'getTask', 'peopleForAi'],
  users: ['setup', 'listUsers'],
};
const services = {
  account,
  committees,
  kpis,
  notes,
  notifications,
  people,
  settings,
  tasks,
  users,
};
describe('service transaction ownership', () => {
  it.each(Object.entries(services))(
    'ADMIN-B36 every writing export of %s owns its transaction',
    (name, module) => {
      const functions = Object.entries(module).filter(([, value]) => typeof value === 'function');
      const unwrapped = functions
        .filter(([key, value]) => !exempt[name]?.includes(key) && !isTransactional(value))
        .map(([key]) => key);
      expect(unwrapped).toEqual([]);
      const known = new Set(functions.map(([key]) => key));
      expect((exempt[name] ?? []).filter((key) => !known.has(key))).toEqual([]);
    },
  );
});
