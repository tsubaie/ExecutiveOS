import { addDays, dayAt } from './days';
export { addDays, dayAt };
// NOTES-B06: one band definition shared by list grouping and the UI.
export function bandOf(noteDate: string, today: string) {
  if (noteDate > today) return 'upcoming';
  if (noteDate === today) return 'today';
  if (noteDate >= addDays(today, -6)) return 'week';
  return noteDate >= addDays(today, -30) ? 'month' : 'earlier';
}
