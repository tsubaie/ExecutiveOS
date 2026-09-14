import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import {
  KpiDetail,
  KpiCreate,
  KpiPatch,
  KpiList,
  KpiListQuery,
  KpiFacets,
  Objective,
  ObjectiveCreate,
  ObjectivePatch,
  ObjectiveList,
  ReadingCreate,
  ReadingUpsert,
  ReadingPatch,
  ReadingList,
  TargetsPut,
  TargetList,
  Revision,
  Reorder,
} from './schema/validation';
import * as service from './service';
const uuid = (params: Record<string, string>, key = 'id') => z.uuid().parse(params[key]);
const kpi = z.object({ data: KpiDetail });
const objective = z.object({ data: Objective });
const opId = z.object({ opId: z.uuid() });
const trash = z.strictObject({ includeDeleted: z.enum(['true', 'false']).optional() });
export const list = defineHandler({
  guard: 'session',
  input: KpiListQuery,
  response: KpiList,
  handler: (input, ctx) => service.listKpis(authenticated(ctx), input),
});
export const facets = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: KpiFacets,
  handler: (_input, ctx) => service.kpiFacets(authenticated(ctx)),
});
export const create = defineHandler({
  guard: 'session',
  input: KpiCreate,
  response: kpi,
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.createKpi(authenticated(ctx), input) }),
});
export const detail = defineHandler({
  guard: 'session',
  input: trash,
  response: kpi,
  handler: async (input, ctx, params) => ({
    data: await service.getKpiDetail(
      authenticated(ctx),
      uuid(params),
      input.includeDeleted === 'true',
    ),
  }),
});
export const patch = defineHandler({
  guard: 'session',
  input: KpiPatch,
  response: kpi,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchKpi(authenticated(ctx), uuid(params), input),
  }),
});
export const remove = defineHandler({
  guard: 'session',
  input: Revision,
  response: opId,
  status: 204,
  handler: (input, ctx, params) =>
    service.removeKpi(authenticated(ctx), uuid(params), input.revision),
});
export const restore = defineHandler({
  guard: 'session',
  input: z.strictObject({ opId: z.uuid() }),
  response: kpi,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.restoreKpi(authenticated(ctx), uuid(params), input.opId),
  }),
});
export const readings = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: ReadingList,
  handler: (_input, ctx, params) => service.listReadings(authenticated(ctx), uuid(params)),
});
export const addReading = defineHandler({
  guard: 'session',
  input: ReadingCreate,
  response: kpi,
  status: 201,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.addReading(authenticated(ctx), uuid(params), input),
  }),
});
// KPIS-B09: the overwrite the 409 offers. The date is the address, so a repeat is the same write.
export const overwriteReading = defineHandler({
  guard: 'session',
  input: ReadingUpsert,
  response: kpi,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.overwriteReading(
      authenticated(ctx),
      uuid(params),
      z.iso.date().parse(params.reading),
      input,
    ),
  }),
});
export const patchReading = defineHandler({
  guard: 'session',
  input: ReadingPatch,
  response: kpi,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchReading(
      authenticated(ctx),
      uuid(params),
      uuid(params, 'reading'),
      input,
    ),
  }),
});
export const removeReading = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: opId,
  status: 204,
  handler: (_input, ctx, params) =>
    service.removeReading(authenticated(ctx), uuid(params), uuid(params, 'reading')),
});
export const targets = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: TargetList,
  handler: (_input, ctx, params) => service.listTargets(authenticated(ctx), uuid(params)),
});
export const putTargets = defineHandler({
  guard: 'session',
  input: TargetsPut,
  response: kpi,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.putTargets(authenticated(ctx), uuid(params), input),
  }),
});
export const removeTarget = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: opId,
  status: 204,
  handler: (_input, ctx, params) =>
    service.removeTarget(authenticated(ctx), uuid(params), uuid(params, 'target')),
});
export const objectives = defineHandler({
  guard: 'session',
  input: trash,
  response: ObjectiveList,
  handler: (input, ctx) =>
    service.listObjectives(authenticated(ctx), input.includeDeleted === 'true'),
});
export const createObjective = defineHandler({
  guard: 'admin',
  input: ObjectiveCreate,
  response: objective,
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => ({
    data: await service.createObjective(authenticated(ctx), input),
  }),
});
export const patchObjective = defineHandler({
  guard: 'admin',
  input: ObjectivePatch,
  response: objective,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchObjective(authenticated(ctx), uuid(params), input),
  }),
});
export const removeObjective = defineHandler({
  guard: 'admin',
  input: Revision,
  response: opId,
  status: 204,
  handler: (input, ctx, params) =>
    service.removeObjective(authenticated(ctx), uuid(params), input.revision),
});
export const restoreObjective = defineHandler({
  guard: 'admin',
  input: z.strictObject({ opId: z.uuid() }),
  response: objective,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.restoreObjective(authenticated(ctx), uuid(params), input.opId),
  }),
});
export const reorderObjectives = defineHandler({
  guard: 'admin',
  input: Reorder,
  response: z.object({ data: z.object({ updatedIds: z.array(z.uuid()) }) }),
  idempotent: true,
  handler: (input, ctx) => service.reorderObjectives(authenticated(ctx), input.items),
});
