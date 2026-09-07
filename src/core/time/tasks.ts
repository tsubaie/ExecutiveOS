import { addDays, dayAt } from './days';
export { addDays, dayAt };
export function bandOf(task: { status: string; dueDate: string | null }, today: string) {
  if (task.status === 'completed') return null;
  if (!task.dueDate) return 'nodate';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return task.dueDate <= addDays(today, 7) ? 'week' : 'later';
}
