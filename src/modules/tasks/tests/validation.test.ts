import { describe, it, expect } from 'vitest';
import { TaskCreate, TaskPatch, Group, Reorder } from '../schema/validation';
import { bandOf, dayAt, addDays } from '@/core/time/tasks';
describe('TASKS-B01 TASKS-B02 schema boundaries', () => {
  it('defaults to inbox and rejects blank titles, bad dates and keeps PATCH fields optional', () => {
    expect(TaskCreate.parse({ title: ' Review ' })).toMatchObject({
      title: 'Review',
      status: 'inbox',
      ownerId: null,
    });
    for (const input of [{ title: '' }, { title: 'x', dueDate: '2026-02-30' }])
      expect(TaskCreate.safeParse(input).success).toBe(false);
    expect(TaskPatch.parse({ revision: 1, title: 'Edit' })).toEqual({ revision: 1, title: 'Edit' });
    expect(Group.safeParse({ title: 'x', childIds: [] }).success).toBe(false);
    expect(Reorder.safeParse({ parentId: null, orderedIds: ['bad'] }).success).toBe(false);
  });
});
it('TASKS-B03 TASKS-A02 rolling bands and timezone midnight including DST', () => {
  for (const [timezone, before, after] of [
    ['Asia/Riyadh', '2026-09-07T20:59:59Z', '2026-09-07T21:00:00Z'],
    ['America/New_York', '2026-03-08T04:59:59Z', '2026-03-08T05:00:00Z'],
  ]) {
    const today = dayAt(timezone!, before!);
    const task = { status: 'inbox', dueDate: today };
    expect(bandOf(task, today)).toBe('today');
    expect(bandOf(task, dayAt(timezone!, after!))).toBe('overdue');
    expect(bandOf({ ...task, dueDate: addDays(today, 7) }, today)).toBe('week');
    expect(bandOf({ ...task, dueDate: addDays(today, 8) }, today)).toBe('later');
    expect(bandOf({ ...task, dueDate: null }, today)).toBe('nodate');
    expect(bandOf({ ...task, status: 'completed' }, today)).toBeNull();
  }
});
