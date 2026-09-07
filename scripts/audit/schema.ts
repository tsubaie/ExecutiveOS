import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { databaseFor, testPool } from '../../src/core/db/client';
import { resetDatabase } from '../../src/core/db/reset';
import {
  describeTable,
  listExtensions,
  listFunctions,
  listTables,
  shapeOf,
  type DbTable,
  type TableShape,
} from '../../src/core/db/introspect';
import { Role } from '../../src/core/http/user-schema';
import { JobStatus } from '../../src/core/jobs/types';
import { Status, Priority } from '../../src/modules/tasks/schema/validation';
import { Kind } from '../../src/modules/people/schema/validation';
import { read, walk } from './lib/files';
import { report, finish, type Finding, type Report } from './lib/report';
const run = promisify(execFile);
const CustomObjects = z.object({
  extensions: z.array(z.string()).default([]),
  functions: z.array(z.string()).default([]),
  columns: z.record(z.string(), z.array(z.string())).default({}),
  indexes: z.record(z.string(), z.array(z.string())).default({}),
  constraints: z.record(z.string(), z.array(z.string())).default({}),
  triggers: z.record(z.string(), z.array(z.string())).default({}),
});
export type CustomObjects = z.infer<typeof CustomObjects>;
export type EnumCheck = { table: string; column: string; options: readonly string[] };
export const entityColumns = [
  'id',
  'revision',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_at',
  'deleted_op_id',
];
const implicitIndex = /_pkey$|_unique$|_key$/u;
function columnFindings(shape: TableShape, table: DbTable, custom: CustomObjects): Finding[] {
  const findings: Finding[] = [];
  const file = shape.name;
  const actual = new Map(table.columns.map((column) => [column.name, column]));
  for (const column of shape.columns) {
    const found = actual.get(column.name);
    if (!found)
      findings.push({
        rule: 'column-missing',
        file,
        message: `${column.name} is declared but absent`,
      });
    else if (found.nullable === column.notNull)
      findings.push({
        rule: 'column-nullability',
        file,
        message: `${column.name} nullability differs`,
      });
  }
  const declared = new Set([
    ...shape.columns.map((c) => c.name),
    ...(custom.columns[shape.name] ?? []),
  ]);
  for (const column of table.columns)
    if (!declared.has(column.name))
      findings.push({
        rule: 'column-drift',
        file,
        message: `${column.name} exists only in the database`,
      });
  return findings;
}
function indexFindings(shape: TableShape, table: DbTable, custom: CustomObjects): Finding[] {
  const findings: Finding[] = [];
  const file = shape.name;
  const expected = new Set([...shape.indexes, ...(custom.indexes[shape.name] ?? [])]);
  const constraintIndexes = new Set(table.constraints.map((constraint) => constraint.name));
  for (const name of expected)
    if (!table.indexes.some((index) => index.name === name))
      findings.push({ rule: 'index-missing', file, message: name });
  for (const index of table.indexes)
    if (
      !expected.has(index.name) &&
      !implicitIndex.test(index.name) &&
      !constraintIndexes.has(index.name)
    )
      findings.push({
        rule: 'index-drift',
        file,
        message: `${index.name} exists only in the database`,
      });
  return findings;
}
function checkFindings(shape: TableShape, table: DbTable, custom: CustomObjects): Finding[] {
  const findings: Finding[] = [];
  const file = shape.name;
  const expected = new Set([...shape.checks, ...(custom.constraints[shape.name] ?? [])]);
  const actual = table.constraints
    .filter((c) => c.type === 'c' || c.type === 'x')
    .map((c) => c.name);
  for (const name of expected)
    if (!actual.includes(name)) findings.push({ rule: 'check-missing', file, message: name });
  for (const name of actual)
    if (!expected.has(name))
      findings.push({ rule: 'check-drift', file, message: `${name} exists only in the database` });
  return findings;
}
function triggerFindings(shape: TableShape, table: DbTable, custom: CustomObjects): Finding[] {
  const findings: Finding[] = [];
  const file = shape.name;
  const expected = custom.triggers[shape.name] ?? [];
  for (const name of expected)
    if (!table.triggers.includes(name))
      findings.push({ rule: 'trigger-missing', file, message: name });
  for (const name of table.triggers)
    if (!expected.includes(name))
      findings.push({
        rule: 'trigger-drift',
        file,
        message: `${name} is not declared in drizzle/custom-objects.json`,
      });
  return findings;
}
function objectFindings(shape: TableShape, table: DbTable, custom: CustomObjects): Finding[] {
  return [
    ...indexFindings(shape, table, custom),
    ...checkFindings(shape, table, custom),
    ...triggerFindings(shape, table, custom),
  ];
}
function ruleFindings(
  shape: TableShape,
  table: DbTable,
  entityTables: string[],
  enums: EnumCheck[],
): Finding[] {
  const findings: Finding[] = [];
  const file = shape.name;
  const leading = table.indexes.map(
    (index) => index.definition.match(/\(\s*"?(\w+)"?/u)?.[1] ?? '',
  );
  for (const columns of shape.foreignKeyColumns)
    if (!leading.includes(columns[0] ?? ''))
      findings.push({
        rule: 'fk-index',
        file,
        message: `${columns.join(',')} has no leading index`,
      });
  if (entityTables.includes(shape.name))
    for (const column of entityColumns)
      if (!table.columns.some((c) => c.name === column))
        findings.push({ rule: 'entity-columns', file, message: `entity table lacks ${column}` });
  for (const check of enums.filter((item) => item.table === shape.name)) {
    const satisfied = table.constraints.some(
      (c) =>
        c.type === 'c' &&
        c.definition.includes(check.column) &&
        check.options.every((option) => c.definition.includes(`'${option}'`)),
    );
    if (!satisfied)
      findings.push({
        rule: 'enum-check',
        file,
        message: `${check.column} has no CHECK listing ${check.options.join(', ')}`,
      });
  }
  return findings;
}
export function evaluateTable(
  shape: TableShape,
  table: DbTable,
  custom: CustomObjects,
  entityTables: string[],
  enums: EnumCheck[],
) {
  return [
    ...columnFindings(shape, table, custom),
    ...objectFindings(shape, table, custom),
    ...ruleFindings(shape, table, entityTables, enums),
  ];
}
export function evaluateCatalog(
  shapes: TableShape[],
  tables: DbTable[],
  catalog: { functions: string[]; extensions: string[] },
  custom: CustomObjects,
  entityTables: string[],
  enums: EnumCheck[],
): Report {
  const result = report('audit:schema');
  for (const shape of shapes) {
    const table = tables.find((item) => item.name === shape.name);
    if (!table)
      result.violations.push({
        rule: 'table-missing',
        file: shape.name,
        message: 'declared table absent from the database',
      });
    else result.violations.push(...evaluateTable(shape, table, custom, entityTables, enums));
  }
  for (const table of tables)
    if (!shapes.some((shape) => shape.name === table.name))
      result.violations.push({
        rule: 'table-drift',
        file: table.name,
        message: 'table exists only in the database',
      });
  for (const name of custom.functions)
    if (!catalog.functions.includes(name))
      result.violations.push({
        rule: 'function-missing',
        file: name,
        message: 'declared custom function absent',
      });
  for (const name of catalog.functions)
    if (!custom.functions.includes(name))
      result.violations.push({
        rule: 'function-drift',
        file: name,
        message: 'undeclared function in the database',
      });
  for (const name of custom.extensions)
    if (!catalog.extensions.includes(name))
      result.violations.push({
        rule: 'extension-missing',
        file: name,
        message: 'declared extension absent',
      });
  return result;
}
export function parseEntityTables(doc: string) {
  return (doc.match(/^\| \*\*Entity\*\* \| ([^|]+) \|/mu)?.[1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}
async function loadShapes(root: string) {
  const files = [
    'src/core/db/system-schema.ts',
    ...(await walk(join(root, 'src/modules')))
      .filter((f) => f.endsWith('schema/db.ts'))
      .map((f) => `src/modules/${f}`),
  ];
  const shapes: TableShape[] = [];
  for (const file of files) {
    const exported = z
      .record(z.string(), z.unknown())
      .parse(await import(pathToFileURL(join(root, file)).href));
    for (const value of Object.values(exported)) {
      if (typeof value !== 'object' || value === null) continue;
      const shape = shapeOf(value);
      if (shape) shapes.push(shape);
    }
  }
  return shapes;
}
async function drizzleKitCheck(root: string): Promise<Finding[]> {
  try {
    await run(join(root, 'node_modules/.bin/drizzle-kit'), ['check'], { cwd: root });
    return [];
  } catch (error) {
    const failed = z
      .object({ stdout: z.string().default(''), stderr: z.string().default('') })
      .safeParse(error);
    return [
      {
        rule: 'drizzle-kit-check',
        message: (failed.success ? failed.data.stdout + failed.data.stderr : 'failed')
          .trim()
          .slice(-500),
      },
    ];
  }
}
export async function auditSchema(root: string) {
  const source = testPool();
  const database = databaseFor(source);
  try {
    await resetDatabase(source);
    const custom = CustomObjects.parse(
      JSON.parse(await read(join(root, 'drizzle/custom-objects.json'))),
    );
    const entityTables = parseEntityTables(await read(join(root, 'docs/03-data-model.md')));
    const enums: EnumCheck[] = [
      { table: 'tasks', column: 'status', options: Status.options },
      { table: 'tasks', column: 'priority', options: Priority.options },
      { table: 'people', column: 'kind', options: Kind.options },
      { table: 'users', column: 'role', options: Role.options },
      { table: 'jobs', column: 'status', options: JobStatus.options },
    ];
    const tables: DbTable[] = [];
    for (const name of await listTables(database)) tables.push(await describeTable(database, name));
    const catalog = {
      functions: await listFunctions(database),
      extensions: await listExtensions(database),
    };
    const result = evaluateCatalog(
      await loadShapes(root),
      tables,
      catalog,
      custom,
      entityTables,
      enums,
    );
    result.violations.push(...(await drizzleKitCheck(root)));
    return result;
  } finally {
    await source.end();
  }
}
if (process.argv[1]?.endsWith('schema.ts')) finish(await auditSchema(process.cwd()));
