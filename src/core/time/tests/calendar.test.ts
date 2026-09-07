import { describe, expect, it } from 'vitest';
import {
  addMonths,
  endOfWeek,
  firstOfMonth,
  monthGrid,
  monthOf,
  startOfNextWeek,
} from '../calendar';
import { addDays, dayAt, weekdayOf } from '../days';
const days = (month: string) => monthGrid(month).map((row) => row.map((cell) => cell.day));
describe('calendar helpers', () => {
  it('EP-B07 month grid starts on Sunday and pads both ends to full weeks with stable keys', () => {
    const grid = days('2026-08');
    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-08-01']);
    expect(grid[5]?.slice(0, 2)).toEqual(['2026-08-30', '2026-08-31']);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(days('2026-02')[0]?.[0]).toBe('2026-02-01');
    expect(days('2028-02').flat().filter(Boolean)).toHaveLength(29);
    const keys = monthGrid('2026-08')
      .flat()
      .map((cell) => cell.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('EP-B07 month navigation and week boundaries', () => {
    expect(monthOf('2026-09-07')).toBe('2026-09');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(firstOfMonth('2026-09')).toBe('2026-09-01');
    expect(endOfWeek('2026-09-07')).toBe('2026-09-12');
    expect(endOfWeek('2026-09-12')).toBe('2026-09-12');
    expect(endOfWeek('2026-09-13')).toBe('2026-09-19');
    expect(startOfNextWeek('2026-09-07')).toBe('2026-09-14');
    expect(startOfNextWeek('2026-09-13')).toBe('2026-09-14');
    expect(startOfNextWeek('2026-09-12')).toBe('2026-09-14');
  });
});
describe('day helpers', () => {
  // Fixed-offset zones keep the assertions independent of DST and of the tripwire on region names.
  it('TASKS-B03 dayAt follows the timezone and addDays crosses month and year ends', () => {
    expect(dayAt('UTC', '2026-09-07T23:30:00Z')).toBe('2026-09-07');
    expect(dayAt('Etc/GMT-3', '2026-09-07T23:30:00Z')).toBe('2026-09-08');
    expect(dayAt('Etc/GMT+7', '2026-09-08T03:30:00Z')).toBe('2026-09-07');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(weekdayOf('2026-09-07')).toBe(1);
    expect(weekdayOf('2026-09-13')).toBe(7);
  });
});
