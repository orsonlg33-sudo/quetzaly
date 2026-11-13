/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BudgetPeriod, FinanceEntry, PeriodSummary } from '../types/finance';

/**
 * Returns the maximum days in month M (0-indexed: 0 = Jan, 1 = Feb, etc.) for year Y.
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of the target month
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns clamped day: if month has fewer days than requested day X, use the last day.
 * Example: if startDay is 31 and month is Feb (non-leap), returns 28.
 */
export function getClampedDay(year: number, month: number, targetDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(Math.max(1, targetDay), maxDays);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD to a local Date object at 00:00:00
 */
export function parseDateKey(key: string): Date {
  const [yearStr, monthStr, dayStr] = key.split('-');
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
}

/**
 * Generates human-friendly label for a period, e.g., "Oct 22 – Nov 21, 2026"
 */
function createPeriodLabel(startDate: Date, endDate: Date): string {
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/**
 * Computes a BudgetPeriod given its anchor year and month (where the cycle begins)
 * and the configured monthStartDay.
 */
export function getPeriodForAnchor(year: number, month: number, startDay: number): BudgetPeriod {
  // Cycle starts on clamped day of (year, month)
  const actualStartDay = getClampedDay(year, month, startDay);
  const startDate = new Date(year, month, actualStartDay, 0, 0, 0, 0);

  // Next cycle begins on next month's anchor
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const nextActualStartDay = getClampedDay(nextYear, nextMonth, startDay);
  const nextCycleStart = new Date(nextYear, nextMonth, nextActualStartDay, 0, 0, 0, 0);

  // Current cycle ends the day before next cycle starts
  const endDate = new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000);

  const startKey = formatDateKey(startDate);
  const endKey = formatDateKey(endDate);

  return {
    id: `period_${startKey}_${endKey}`,
    startDate: startKey,
    endDate: endKey,
    label: createPeriodLabel(startDate, endDate),
    year,
    month,
  };
}

/**
 * Determines which BudgetPeriod a given calendar date belongs to.
 */
export function getPeriodForDate(date: Date, startDay: number): BudgetPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const clampedStartThisMonth = getClampedDay(year, month, startDay);

  if (day >= clampedStartThisMonth) {
    // Current date is on or after the start day of this month -> anchor is (year, month)
    return getPeriodForAnchor(year, month, startDay);
  } else {
    // Current date is before the start day -> anchor is previous month
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    return getPeriodForAnchor(prevYear, prevMonth, startDay);
  }
}

/**
 * Returns a period offset by N months from a reference period
 */
export function getOffsetPeriod(reference: BudgetPeriod, offsetMonths: number, startDay: number): BudgetPeriod {
  let targetMonth = reference.month + offsetMonths;
  let targetYear = reference.year;

  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  return getPeriodForAnchor(targetYear, targetMonth, startDay);
}

/**
 * Calculates financial summary for a given period:
 * - periodIncome: sum of income in home cents during the period
 * - periodExpenses: sum of expenses in home cents during the period
 * - carriedOverBefore: sum of (income - expenses) strictly before startDate
 * - effectiveStartingBalance: carriedOverBefore if rolloverEnabled is true, else 0
 */
export function calculatePeriodSummary(
  entries: FinanceEntry[],
  period: BudgetPeriod,
  rolloverEnabled: boolean
): PeriodSummary {
  let periodIncome = 0;
  let periodExpenses = 0;
  let carriedOverBefore = 0;
  let entryCount = 0;
  let pendingCount = 0;

  for (const entry of entries) {
    const isPendingWithoutRate = entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0);
    // Use homeAmount in integer cents (use cached/estimated rate if exists, otherwise 0)
    const amount = isPendingWithoutRate ? 0 : (entry.homeAmount ?? entry.amount ?? 0);

    if (entry.date < period.startDate) {
      if (!isPendingWithoutRate) {
        if (entry.type === 'income') {
          carriedOverBefore += amount;
        } else {
          carriedOverBefore -= amount;
        }
      }
    } else if (entry.date >= period.startDate && entry.date <= period.endDate) {
      entryCount += 1;
      if (isPendingWithoutRate) {
        pendingCount += 1;
      } else {
        if (entry.type === 'income') {
          periodIncome += amount;
        } else {
          periodExpenses += amount;
        }
      }
    }
  }

  const periodBalance = periodIncome - periodExpenses;
  const effectiveStartingBalance = rolloverEnabled ? carriedOverBefore : 0;
  const totalAvailable = effectiveStartingBalance + periodIncome;
  const netLeft = totalAvailable - periodExpenses;

  return {
    period,
    periodIncome,
    periodExpenses,
    periodBalance,
    carriedOverBefore,
    effectiveStartingBalance,
    totalAvailable,
    netLeft,
    entryCount,
    pendingCount,
  };
}

/**
 * Returns all historical and current periods that have entries, ordered chronologically.
 */
export function getAllPeriodsWithData(
  entries: FinanceEntry[],
  startDay: number,
  currentPeriod: BudgetPeriod
): BudgetPeriod[] {
  const periodMap = new Map<string, BudgetPeriod>();
  periodMap.set(currentPeriod.id, currentPeriod);

  for (const entry of entries) {
    const entryDate = parseDateKey(entry.date);
    const p = getPeriodForDate(entryDate, startDay);
    if (!periodMap.has(p.id)) {
      periodMap.set(p.id, p);
    }
  }

  return Array.from(periodMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}
