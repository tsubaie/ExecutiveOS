import type { Database } from '../../src/core/db/client';
import type { User } from '../../src/core/http/user-schema';
import { id } from '../../src/core/db/ids';
import { defaults } from '../../src/core/config/defaults';
import { dayAt, addDays } from '../../src/core/time/tasks';
import { createPerson } from '../../src/modules/people';
import { PersonCreate } from '../../src/modules/people/schema/validation';
import { createTask } from '../../src/modules/tasks/service';
import { TaskCreate, Priority, OpenStatus } from '../../src/modules/tasks/schema/validation';
// Deterministic volume data for audit:perf and `pnpm db:seed --large`. Invented values only.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const words = ['report', 'budget', 'briefing', 'agenda', 'review', 'تقرير', 'ميزانية', 'اجتماع'];
export async function seedLarge(
  database: Database,
  user: User,
  counts: { people: number; tasks: number },
) {
  const next = random(7);
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)] ?? items[0];
  const ctx = { db: database, user, requestId: id() };
  const owners: string[] = [];
  for (let index = 0; index < counts.people; index += 1) {
    const person = await createPerson(
      ctx,
      PersonCreate.parse({
        fullName: `Sample Person ${index}`,
        displayName: null,
        honorific: null,
        organization: `Sample Organization ${index % 20}`,
        roleTitle: null,
        kind: index % 3 ? 'internal' : 'external',
        email: null,
        phone: null,
        notes: null,
        tags: [`tag${index % 7}`],
        isAssignable: index % 2 === 0,
        userId: null,
        confirmDuplicate: true,
      }),
    );
    if (person.data?.isAssignable) owners.push(person.data.id);
  }
  const today = dayAt(defaults.timezone);
  for (let index = 0; index < counts.tasks; index += 1) {
    const parent = await createTask(ctx, sampleTask(index, next, pick, owners, today));
    if (index % 10 === 0)
      for (let child = 0; child < 3; child += 1)
        await createTask(
          ctx,
          TaskCreate.parse({ title: `Subtask ${child} of ${index}`, parentId: parent.id }),
        );
  }
}
function sampleTask(
  index: number,
  next: () => number,
  pick: <T>(items: readonly T[]) => T | undefined,
  owners: string[],
  today: string,
) {
  return TaskCreate.parse({
    title: `Sample task ${index} ${pick(words)}`,
    description: next() > 0.5 ? `Generated description ${pick(words)}` : null,
    status: pick(OpenStatus.options),
    priority: next() > 0.4 ? pick(Priority.options) : null,
    dueDate: next() > 0.3 ? addDays(today, Math.floor(next() * 60) - 30) : null,
    ownerId: next() > 0.5 ? (pick(owners) ?? null) : null,
  });
}
