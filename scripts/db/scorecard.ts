import type { Database } from '../../src/core/db/client';
import type { User } from '../../src/core/http/user-schema';
import { id } from '../../src/core/db/ids';
import { dayAt, addDays } from '../../src/core/time/tasks';
import { periodOf, shiftPeriod } from '../../src/core/time/kpis';
import { getSetting } from '../../src/core/db/settings-repo';
import {
  addReading,
  createKpi,
  createObjective,
  listKpis,
  listObjectives,
  putTargets,
} from '../../src/modules/kpis';
import { assignablePeople } from '../../src/modules/people';
import {
  KpiCreate,
  KpiListQuery,
  ObjectiveCreate,
  ReadingCreate,
} from '../../src/modules/kpis/schema/validation';
import { seedKpis, seedObjective } from '../../tests/fixtures/kpis';
// The preview scorecard (docs/03 § Seed data). Readings are placed relative to today and targets
// relative to the current period of each measure's own cadence, so the seed reads the same way in
// any month it is loaded. Re-running it adds nothing: a measure already present by name is left as
// the workspace has it.
export async function seedScorecard(database: Database, user: User) {
  const ctx = { db: database, user, requestId: id() };
  const today = dayAt(await getSetting(database, 'workspace.timezone'));
  const listed = await listKpis(ctx, KpiListQuery.parse({ view: 'all', limit: 200 }));
  const present = new Set(listed.data.map((row) => row.name));
  const owners = new Map((await assignablePeople(ctx)).map((row) => [row.name, row.id]));
  const objectives = await listObjectives(ctx);
  const objective =
    objectives.data.find((row) => row.name === seedObjective.name) ??
    (await createObjective(ctx, ObjectiveCreate.parse(seedObjective)));
  for (const measure of seedKpis) {
    if (present.has(measure.name)) continue;
    const kpi = await createKpi(
      ctx,
      KpiCreate.parse({
        name: measure.name,
        unit: measure.unit,
        direction: measure.direction,
        frequency: measure.frequency,
        category: measure.category,
        ownerId: (measure.owner && owners.get(measure.owner)) ?? null,
        notes: measure.notes,
        objectiveId: measure.underObjective ? objective.id : null,
      }),
    );
    for (const reading of measure.readings)
      await addReading(
        ctx,
        kpi.id,
        ReadingCreate.parse({
          readingDate: addDays(today, -reading.daysAgo),
          value: reading.value,
          note: '',
        }),
      );
    if (measure.targets.length)
      await putTargets(ctx, kpi.id, {
        items: measure.targets.map((target) => ({
          ...shiftPeriod(
            periodOf(today, measure.frequency),
            target.periodsAhead,
            measure.frequency,
          ),
          targetValue: target.value,
        })),
      });
  }
}
