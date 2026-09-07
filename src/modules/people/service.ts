/** PEOPLE-I01–I04: required identity, confirmed homonyms, admin-only member linking, principal protection. */
import 'server-only';
import { z } from 'zod';
import { type Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { settingValue } from '@/core/db/settings-repo';
import { writeAudit } from '@/core/db/http-repo';
import { AppError } from '@/core/http/errors';
import { filtersHash, readCursor, makeCursor } from '@/core/http/pagination';
import {
  Person,
  View,
  type PersonCreate,
  type PersonPatch,
  type PersonListQuery,
} from './schema/validation';
import * as repo from './repo';

export async function listPeople(ctx: Context, query: PersonListQuery) {
  const hash = filtersHash({
    view: query.view,
    q: query.q,
    tag: query.tag,
    organization: query.organization,
    day: new Date().toISOString().slice(0, 10),
  });
  const rows = await repo.selectPeople(
    ctx.db,
    query,
    query.limit + 1,
    readCursor(query.cursor, hash),
  );
  const viewCounts: Record<string, number> = {};
  for (const view of View.options)
    viewCounts[view] = await repo.countPeople(ctx.db, { ...query, view });
  const counts = z.record(View, z.number()).parse(viewCounts);
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    data: items.map((row) => Person.parse(row)),
    meta: {
      counts,
      total: counts[query.view],
      nextCursor:
        rows.length > query.limit && last ? makeCursor(last.fullName, last.id, hash) : null,
    },
  };
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
  await writeAudit(ctx.db, ctx.user.id, 'create', 'person', person.id, z.json().parse(person));
  return { data: person, meta: { possibleDuplicates: [] } };
}
export async function patchPerson(ctx: Context, personId: string, input: PersonPatch) {
  memberLink(ctx, input.userId);
  await getPerson(ctx, personId);
  const { revision, ...fields } = input;
  const row = await repo.updatePerson(ctx.db, personId, revision, {
    ...fields,
    updatedBy: ctx.user.id,
  });
  if (!row)
    throw new AppError('conflict', { reason: 'revision', current: await getPerson(ctx, personId) });
  await writeAudit(ctx.db, ctx.user.id, 'update', 'person', personId, z.json().parse(fields));
  return Person.parse(row);
}
export async function removePerson(ctx: Context, personId: string, revision: number) {
  const principal = await settingValue(ctx.db, 'workspace.principal_person_id');
  if (principal === personId) throw new AppError('rule_violation', { rule: 'PEOPLE-I04' });
  await getPerson(ctx, personId);
  const opId = id();
  const row = await repo.updatePerson(ctx.db, personId, revision, {
    deletedAt: new Date(),
    deletedOpId: opId,
    updatedBy: ctx.user.id,
  });
  if (!row)
    throw new AppError('conflict', { reason: 'revision', current: await getPerson(ctx, personId) });
  await writeAudit(ctx.db, ctx.user.id, 'delete', 'person', personId, {}, opId);
  return { opId };
}
export async function restorePerson(ctx: Context, personId: string, opId: string) {
  const old = await getPerson(ctx, personId, true);
  if (old.deletedOpId !== opId) throw new AppError('conflict', { reason: 'state' });
  const row = await repo.updatePerson(ctx.db, personId, old.revision, {
    deletedAt: null,
    deletedOpId: null,
    updatedBy: ctx.user.id,
  });
  if (!row) throw new AppError('conflict', { reason: 'revision' });
  await writeAudit(ctx.db, ctx.user.id, 'restore', 'person', personId, {}, opId);
  return Person.parse(row);
}
