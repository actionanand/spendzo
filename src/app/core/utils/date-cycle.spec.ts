import { calculateCycleBounds, containsDate, createCurrentCycle, localDateKey } from './date-cycle';

describe('budget-cycle utilities', () => {
  it('uses the calendar month by default', () => {
    expect(calculateCycleBounds(new Date(2026, 6, 28), 1)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
  });

  it('creates a 25th through 24th cycle', () => {
    expect(calculateCycleBounds(new Date(2026, 6, 28), 25)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-08-24',
    });
    expect(calculateCycleBounds(new Date(2026, 6, 10), 25)).toEqual({
      startDate: '2026-06-25',
      endDate: '2026-07-24',
    });
  });

  it('handles February and leap years for day 31', () => {
    expect(calculateCycleBounds(new Date(2026, 1, 28), 31)).toEqual({
      startDate: '2026-02-28',
      endDate: '2026-03-30',
    });
    expect(calculateCycleBounds(new Date(2028, 1, 29), 31)).toEqual({
      startDate: '2028-02-29',
      endDate: '2028-03-30',
    });
  });

  it('assigns dates to the correct cycle', () => {
    const cycle = createCurrentCycle(25, new Date(2026, 6, 28));
    expect(containsDate(cycle, '2026-07-25')).toBe(true);
    expect(containsDate(cycle, '2026-08-24')).toBe(true);
    expect(containsDate(cycle, '2026-08-25')).toBe(false);
  });

  it('creates local date keys without UTC shifting', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
