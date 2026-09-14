import { sql } from 'drizzle-orm';
import { db, type Database } from '@/core/db/client';
import { insertUser } from '@/core/db/auth-repo';
import { User } from '@/core/http/user-schema';
import { id } from '@/core/db/ids';
import { dayAt } from '@/core/time/days';
import { getSetting } from '@/core/db/settings-repo';
import { KpiCreate, ObjectiveCreate, ReadingCreate } from '../schema/validation';
import * as service from '../service';
export type Ctx = { db: Database; user: User; requestId: string };
// Shared harness for the scorecard scenarios: a clean database, one admin actor, and factories
// that go through the services so every row carries provenance and every invariant is exercised.
export const harness = {
  user: null as User | null,
  run<T>(action: (ctx: Ctx) => Promise<T>) {
    const user = harness.user;
    if (!user) throw new Error('reset the harness before running a scenario');
    return db().transaction((database) => action({ db: database, user, requestId: id() }));
  },
  async reset() {
    await db().execute(
      sql`truncate kpis, kpi_readings, kpi_targets, objectives, users, settings, audit_log cascade`,
    );
    harness.user = User.parse(
      await insertUser(db(), {
        id: id(),
        name: 'Scorecard Tester',
        email: 'kpis@example.test',
        passwordHash: 'unused-test-hash',
        role: 'admin',
      }),
    );
  },
  kpi(name: string, fields: Partial<KpiCreate> = {}) {
    return harness.run((ctx) => service.createKpi(ctx, KpiCreate.parse({ name, ...fields })));
  },
  objective(name: string, fields: Partial<ObjectiveCreate> = {}) {
    return harness.run((ctx) =>
      service.createObjective(ctx, ObjectiveCreate.parse({ name, ...fields })),
    );
  },
  reading(kpiId: string, readingDate: string, value: number, note = '') {
    return harness.run((ctx) =>
      service.addReading(ctx, kpiId, ReadingCreate.parse({ readingDate, value, note })),
    );
  },
  targets(kpiId: string, items: { year: number; quarter: number; targetValue: number }[]) {
    return harness.run((ctx) => service.putTargets(ctx, kpiId, { items }));
  },
};
export async function workspaceToday() {
  return dayAt(await getSetting(db(), 'workspace.timezone'));
}
