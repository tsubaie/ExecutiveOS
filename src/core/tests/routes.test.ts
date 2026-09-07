import { describe, expect, it } from 'vitest';
import { routes } from '../routes';
describe('routes', () => {
  it('EP-B01 EP-B03 task deep links carry view and id and omit empty parameters', () => {
    expect(routes.tasks({ view: 'overdue', id: 'abc' })).toBe('/tasks?view=overdue&id=abc');
    expect(routes.tasks({ view: '', ownerId: undefined })).toBe('/tasks');
    expect(routes.tasks()).toBe('/tasks');
    expect(routes.person('p1')).toBe('/people?id=p1');
    expect(routes.admin('backups')).toBe('/admin/backups');
  });
});
