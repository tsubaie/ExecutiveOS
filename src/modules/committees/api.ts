import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { Committee, CommitteeCreate, CommitteePatch, CommitteeList, CommitteeListQuery, CommitteeChoices, Revision, Reorder, ActivityQuery, Activity } from './schema/validation';
import * as service from './service';
const id = (params: Record<string, string>) => z.uuid().parse(params.id);
const response = z.object({ data: Committee });
export const list = defineHandler({ guard: 'session', input: CommitteeListQuery, response: CommitteeList,
  handler: (input, ctx) => service.listCommittees(authenticated(ctx), input) });
export const create = defineHandler({ guard: 'session', input: CommitteeCreate, response, status: 201, idempotent: true,
  handler: async (input, ctx) => ({ data: await service.createCommittee(authenticated(ctx), input) }) });
export const detail = defineHandler({ guard: 'session', input: z.strictObject({ includeDeleted: z.enum(['true', 'false']).optional() }), response,
  handler: async (input, ctx, params) => ({ data: await service.getCommittee(authenticated(ctx), id(params), input.includeDeleted === 'true') }) });
export const patch = defineHandler({ guard: 'session', input: CommitteePatch, response, idempotent: true,
  handler: async (input, ctx, params) => ({ data: await service.patchCommittee(authenticated(ctx), id(params), input) }) });
export const remove = defineHandler({ guard: 'session', input: Revision, response: z.object({ opId: z.uuid() }), status: 204,
  handler: (input, ctx, params) => service.removeCommittee(authenticated(ctx), id(params), input.revision) });
export const restore = defineHandler({ guard: 'session', input: z.strictObject({ opId: z.uuid() }), response, idempotent: true,
  handler: async (input, ctx, params) => ({ data: await service.restoreCommittee(authenticated(ctx), id(params), input.opId) }) });
function setStatus(status: 'active' | 'archived') {
  return defineHandler({ guard: 'session', input: Revision, response, idempotent: true,
    handler: async (input, ctx, params) => ({ data: await service.patchCommittee(authenticated(ctx), id(params), { ...input, status }) }) });
}
export const archive = setStatus('archived');
export const unarchive = setStatus('active');
export const choices = defineHandler({ guard: 'session', input: z.strictObject({ current: z.uuid().optional() }), response: CommitteeChoices,
  handler: (input, ctx) => service.committeeChoices(authenticated(ctx), input.current) });
export const activity = defineHandler({ guard: 'session', input: ActivityQuery, response: Activity,
  handler: (input, ctx, params) => service.activity(authenticated(ctx), id(params), input.cursor) });
export const reorder = defineHandler({ guard: 'session', input: Reorder, response: z.object({ data: z.object({ updatedIds: z.array(z.uuid()) }) }), idempotent: true,
  handler: (input, ctx) => service.reorderCommittees(authenticated(ctx), input) });
