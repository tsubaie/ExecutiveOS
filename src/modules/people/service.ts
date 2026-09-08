/** PEOPLE-I01–I04: required identity, confirmed homonyms, admin-only member linking, principal protection. */
import 'server-only';
import { z } from 'zod';
import { type Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { getSetting } from '@/core/db/settings-repo';
import { toJson, writeAudit } from '@/core/db/audit-repo';
import { decodeCursor, encodeCursor, filtersHash } from '@/core/db/keyset';
import { applyUpdate, requireRevision, restoreByOp, type EntityOps } from '@/core/entity/service';
import { AppError } from '@/core/http/errors';
import {
  Person,
  View,
  type PersonCreate,
  type PersonPatch,
  type PersonListQuery,
} from './schema/validation';
import * as repo from './repo';
export { personNameSql } from './repo';
type PersonRow = NonNullable<Awaited<ReturnType<typeof repo.selectPerson>>>;
const ops: EntityOps<Person, PersonRow, Parameters<typeof repo.updatePerson>[3]> = {
  entityType: 'person',
  get: (ctx, personId, includeDeleted) => getPerson(ctx, personId, includeDeleted),
  update: (ctx, personId, revision, patch) =>
    repo.updatePerson(ctx.db, personId, revision, patch, ctx.user.id),
  restore: (ctx, personId, opId) => repo.restorePerson(ctx.db, personId, opId, ctx.user.id),
};
export async function listPeople(ctx: Context, query: PersonListQuery) {
  const { view, q, tag, organization, withTotal } = query;
  const hash = filtersHash({ view, q, tag, organization });
  const rows = await repo.selectPeople(
    ctx.db,
    query,
    query.limit + 1,
    decodeCursor(query.cursor, repo.nameSort, hash),
  );
  const counts = z
    .record(View, z.number())
    .parse(await repo.countPeople(ctx.db, { q, tag, organization }, View.options));
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    data: items.map((row) => Person.parse(row)),
    meta: {
      counts,
      // PEOPLE-B08: meta.total is opt-in (04-api-conventions.md); the view counts always ship.
      ...(withTotal === 'true' ? { total: counts[view] } : {}),
      nextCursor:
        rows.length > query.limit && last ? encodeCursor(repo.nameSort, hash, last) : null,
    },
  };
}
export async function countPeople(ctx: Context) {
  const row = await repo.countPeople(ctx.db, { q: '', tag: '', organization: '' }, ['all']);
  return row?.all ?? 0;
}
export async function getPerson(ctx: Context, personId: string, deleted = false) {
  const row = await repo.selectPerson(ctx.db, personId);
  if (!row || (!deleted && row.deletedAt))
    throw new AppError('not_found', { entityType: 'person' });
  return Person.parse(row);
}
function memberLink(ctx: Context, userId?: string | null) {
  if (userId !== undefined && ctx.user.role !== 'admin')
    throw new AppError('forbidden', { reason: 'role' });
}
export async function createPerson(ctx: Context, input: PersonCreate) {
  if (input.userId) memberLink(ctx, input.userId);
  await repo.lockPeopleCreate(ctx.db, input.fullName);
  const duplicates = (await repo.possibleDuplicates(ctx.db, input.fullName)).map((row) =>
    Person.parse(row),
  );
  if (duplicates.length && !input.confirmDuplicate)
    return { data: null, meta: { possibleDuplicates: duplicates } };
  const { confirmDuplicate, ...fields } = input;
  void confirmDuplicate;
  const person = Person.parse(
    await repo.insertPerson(ctx.db, {
      ...fields,
      id: id(),
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    }),
  );
  await writeAudit(ctx.db, ctx.user.id, 'create', 'person', person.id, toJson(fields));
  return { data: person, meta: { possibleDuplicates: [] } };
}
export async function patchPerson(ctx: Context, personId: string, input: PersonPatch) {
  memberLink(ctx, input.userId);
  const { revision, ...fields } = input;
  const current = await requireRevision(ctx, ops, personId, revision);
  return Person.parse(await applyUpdate(ctx, ops, current, fields));
}
export async function removePerson(ctx: Context, personId: string, revision: number) {
  const principal = await getSetting(ctx.db, 'workspace.principal_person_id');
  if (principal === personId) throw new AppError('rule_violation', { rule: 'PEOPLE-I04' });
  const current = await requireRevision(ctx, ops, personId, revision);
  const opId = id();
  await applyUpdate(
    ctx,
    ops,
    current,
    { deletedAt: new Date(), deletedOpId: opId },
    { action: 'delete', opId, diff: {} },
  );
  return { opId };
}
export async function restorePerson(ctx: Context, personId: string, opId: string) {
  await getPerson(ctx, personId, true);
  return Person.parse(await restoreByOp(ctx, ops, personId, opId));
}
