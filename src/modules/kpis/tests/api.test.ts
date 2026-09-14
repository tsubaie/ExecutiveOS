import { expect, it } from 'vitest';
import { KpiListQuery } from '../schema/validation';
import * as api from '../api';
// docs/04 § Resources and verbs: the guard, the status and the idempotency of every endpoint are
// part of the contract OpenAPI is generated from, so they are pinned here rather than left to a
// reviewer's memory. A scorecard is read by the whole workspace and curated by its administrator.
type Meta = { guard: string; status: number; idempotent: boolean };
const meta = (handler: { meta: Meta }) => ({
  guard: handler.meta.guard,
  status: handler.meta.status,
  idempotent: handler.meta.idempotent,
});
it('KPIS-B07 KPIS-B08 every KPI endpoint is session guarded and every write is idempotent', () => {
  expect(meta(api.list)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.facets)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.detail)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.create)).toEqual({ guard: 'session', status: 201, idempotent: true });
  expect(meta(api.patch)).toEqual({ guard: 'session', status: 200, idempotent: true });
  expect(meta(api.restore)).toEqual({ guard: 'session', status: 200, idempotent: true });
  // A delete answers 204 and carries its operation id in the header (docs/04 § Resources).
  expect(meta(api.remove)).toEqual({ guard: 'session', status: 204, idempotent: false });
});
it('KPIS-B09 readings are addressed by date for an overwrite and by id for an edit', () => {
  expect(meta(api.readings)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.addReading)).toEqual({ guard: 'session', status: 201, idempotent: true });
  expect(meta(api.overwriteReading)).toEqual({ guard: 'session', status: 200, idempotent: true });
  expect(meta(api.patchReading)).toEqual({ guard: 'session', status: 200, idempotent: true });
  expect(meta(api.removeReading)).toEqual({ guard: 'session', status: 204, idempotent: false });
  // The overwrite takes no date in its body: the path segment is the address of the reading.
  expect(api.overwriteReading.meta.input.safeParse({ value: 1, note: '' }).success).toBe(true);
  expect(
    api.overwriteReading.meta.input.safeParse({ value: 1, readingDate: '2026-09-10' }).success,
  ).toBe(false);
});
it('KPIS-B08 targets are replaced a year at a time and removed one quarter at a time', () => {
  expect(meta(api.targets)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.putTargets)).toEqual({ guard: 'session', status: 200, idempotent: true });
  expect(meta(api.removeTarget)).toEqual({ guard: 'session', status: 204, idempotent: false });
});
it('KPIS-B06 objectives are readable by the workspace and written by its administrator', () => {
  expect(meta(api.objectives)).toEqual({ guard: 'session', status: 200, idempotent: false });
  expect(meta(api.createObjective)).toEqual({ guard: 'admin', status: 201, idempotent: true });
  expect(meta(api.patchObjective)).toEqual({ guard: 'admin', status: 200, idempotent: true });
  expect(meta(api.removeObjective)).toEqual({ guard: 'admin', status: 204, idempotent: false });
  expect(meta(api.restoreObjective)).toEqual({ guard: 'admin', status: 200, idempotent: true });
  expect(meta(api.reorderObjectives)).toEqual({ guard: 'admin', status: 200, idempotent: true });
});
it('KPIS-B07 the list query rejects an unknown parameter and clamps its page size', () => {
  const input = api.list.meta.input;
  expect(input.safeParse({ view: 'attention', limit: '25' }).success).toBe(true);
  expect(input.safeParse({ view: 'made_up' }).success).toBe(false);
  expect(input.safeParse({ unknown: '1' }).success).toBe(false);
  expect(input.safeParse({ limit: '500' }).success).toBe(false);
  expect(KpiListQuery.parse({})).toMatchObject({ view: 'all', limit: 50, sort: 'default' });
});
