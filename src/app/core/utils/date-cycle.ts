import { BudgetCycle } from '../models/finance.models';

function validDay(year: number, monthIndex: number, requestedDay: number): number {
  const finalDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(requestedDay, 1), finalDay);
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
}

export function calculateCycleBounds(
  date: Date,
  startDay: number,
): {
  readonly startDate: string;
  readonly endDate: string;
} {
  const day = Math.min(Math.max(Math.trunc(startDay), 1), 31);
  const thisMonthStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    validDay(date.getFullYear(), date.getMonth(), day),
  );
  const start =
    date >= thisMonthStart
      ? thisMonthStart
      : new Date(
          date.getFullYear(),
          date.getMonth() - 1,
          validDay(date.getFullYear(), date.getMonth() - 1, day),
        );
  const nextStart = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    validDay(start.getFullYear(), start.getMonth() + 1, day),
  );
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

export function createCurrentCycle(
  startDay: number,
  now = new Date(),
  previous?: Pick<
    BudgetCycle,
    'totalBudgetMinor' | 'savingsTargetMinor' | 'emergencyAllocationMinor'
  >,
): BudgetCycle {
  const bounds = calculateCycleBounds(now, startDay);
  const timestamp = now.toISOString();
  return {
    id: `cycle-${bounds.startDate}`,
    ...bounds,
    startDay,
    totalBudgetMinor: previous?.totalBudgetMinor ?? 0,
    savingsTargetMinor: previous?.savingsTargetMinor ?? 0,
    emergencyAllocationMinor: previous?.emergencyAllocationMinor ?? 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function containsDate(cycle: BudgetCycle, date: string): boolean {
  return date >= cycle.startDate && date <= cycle.endDate;
}

export function daysInclusive(start: string, end: string): number {
  const milliseconds = parseLocalDate(end).getTime() - parseLocalDate(start).getTime();
  return Math.floor(milliseconds / 86_400_000) + 1;
}
