import { env } from '../../src/core/config/env';
import { ensureTestDatabase } from '../../src/core/db/test-database';
import { databaseFor, testPool, type Database } from '../../src/core/db/client';
import { resetDatabase } from '../../src/core/db/reset';
import { countQueries } from '../../src/core/db/query-log';
import { insertUser } from '../../src/core/db/auth-repo';
import { id } from '../../src/core/db/ids';
import { User } from '../../src/core/http/user-schema';
import { listTasks } from '../../src/modules/tasks/service';
import { TaskListQuery } from '../../src/modules/tasks/schema/validation';
import { listPeople } from '../../src/modules/people/service';
import { PersonListQuery } from '../../src/modules/people/schema/validation';
import { homeSummary } from '../../src/modules/home/service';
import { seedLarge } from '../db/large-data';
import { report, finish, type Report } from './lib/report';
export type Sample = { name: string; ms: number; queries: number };
export const limits = { ms: 300, queries: 6 };
type Ctx = { db: Database; user: User; requestId: string };
const goldenPaths: { name: string; run: (ctx: Ctx) => Promise<object> }[] = [
  {
    name: 'tasks.list default view',
    run: (ctx) => listTasks(ctx, TaskListQuery.parse({ view: 'today' })),
  },
  {
    name: 'tasks.list all sorted by title',
    run: (ctx) => listTasks(ctx, TaskListQuery.parse({ sort: 'title' })),
  },
  { name: 'tasks.list search', run: (ctx) => listTasks(ctx, TaskListQuery.parse({ q: 'تقرير' })) },
  { name: 'people.list', run: (ctx) => listPeople(ctx, PersonListQuery.parse({})) },
  { name: 'home.summary', run: (ctx) => homeSummary(ctx) },
];
export function evaluatePerf(samples: Sample[], budget = limits): Report {
  const result = report('audit:perf');
  for (const sample of samples) {
    if (sample.ms > budget.ms)
      result.violations.push({
        rule: 'server-time',
        file: sample.name,
        message: `${Math.round(sample.ms)} ms exceeds ${budget.ms} ms`,
      });
    if (sample.queries > budget.queries)
      result.violations.push({
        rule: 'query-budget',
        file: sample.name,
        message: `${sample.queries} queries exceed ${budget.queries}`,
      });
  }
  return result;
}
async function measure(
  database: ReturnType<typeof databaseFor>,
  user: User,
  path: (typeof goldenPaths)[number],
): Promise<Sample> {
  const times: number[] = [];
  let queries = 0;
  for (let round = 0; round < 5; round += 1) {
    const started = performance.now();
    const counted = await countQueries(() =>
      database.transaction((tx) => path.run({ db: tx, user, requestId: id() })),
    );
    times.push(performance.now() - started);
    queries = Math.max(queries, counted.queries);
  }
  times.sort((a, b) => a - b);
  return { name: path.name, ms: times[Math.floor(times.length / 2)] ?? 0, queries };
}
export async function auditPerf() {
  await ensureTestDatabase(env().DATABASE_URL_TEST ?? '');
  const source = testPool();
  const database = databaseFor(source);
  try {
    await resetDatabase(source);
    const user = User.parse(
      await insertUser(database, {
        id: id(),
        name: 'Perf Auditor',
        email: 'perf@example.test',
        passwordHash: 'unused',
        role: 'admin',
      }),
    );
    await database.transaction((tx) => seedLarge(tx, user, { people: 200, tasks: 1500 }));
    const samples: Sample[] = [];
    for (const path of goldenPaths) samples.push(await measure(database, user, path));
    const result = evaluatePerf(samples);
    for (const sample of samples)
      result.warnings.push({
        rule: 'sample',
        file: sample.name,
        message: `${Math.round(sample.ms)} ms, ${sample.queries} queries`,
      });
    return result;
  } finally {
    await source.end();
  }
}
if (process.argv[1]?.endsWith('perf.ts')) finish(await auditPerf());
