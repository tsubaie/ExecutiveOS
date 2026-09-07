import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import {
  Person,
  PersonCreate,
  PersonPatch,
  PersonList,
  PersonListQuery,
  PersonCreated,
} from './schema/validation';
import * as service from './service';
const personId = (params: Record<string, string>) => z.uuid().parse(params.id);
export const list = defineHandler({
  guard: 'session',
  input: PersonListQuery,
  response: PersonList,
  handler: (input, ctx) => service.listPeople(authenticated(ctx), input),
});
export const create = defineHandler({
  guard: 'session',
  input: PersonCreate,
  response: PersonCreated,
  status: 201,
  idempotent: true,
  handler: (input, ctx) => service.createPerson(authenticated(ctx), input),
});
export const detail = defineHandler({
  guard: 'session',
  input: z.strictObject({ includeDeleted: z.enum(['true', 'false']).optional() }),
  response: z.object({ data: Person }),
  handler: async (input, ctx, params) => ({
    data: await service.getPerson(
      authenticated(ctx),
      personId(params),
      input.includeDeleted === 'true',
    ),
  }),
});
export const patch = defineHandler({
  guard: 'session',
  input: PersonPatch,
  response: z.object({ data: Person }),
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchPerson(authenticated(ctx), personId(params), input),
  }),
});
export const remove = defineHandler({
  guard: 'session',
  input: z.strictObject({ revision: z.number().int().positive() }),
  response: z.object({ opId: z.uuid() }),
  status: 204,
  handler: (input, ctx, params) =>
    service.removePerson(authenticated(ctx), personId(params), input.revision),
});
export const restore = defineHandler({
  guard: 'session',
  input: z.strictObject({ opId: z.uuid() }),
  response: z.object({ data: Person }),
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.restorePerson(authenticated(ctx), personId(params), input.opId),
  }),
});
