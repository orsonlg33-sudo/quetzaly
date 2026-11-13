/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BudgetLimit, BudgetPeriod, FinanceEntry, PeriodSummary } from '../types/finance';
import { formatDateKey, parseDateKey } from './periodMath';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CycleDayMetrics {
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  todayKey: string;
}

export interface DailyAverageMetrics {
  totalExpensesSoFarCents: number;
  daysElapsed: number;
  averageDailyCents: number;
  hasAverage: boolean;
}

export interface HeroCardMetrics {
  hasIncome: boolean;
  hasOverallLimit: boolean;
  showDailyAllowance: boolean;
  heroLabel: 'Left to spend' | 'No Income Logged Yet';
  heroDisplayMode: 'left' | 'spent';
  heroAmountCents: number;
  leftToSpendCents: number | null;
  dailyAllowanceCents: number | null;
  averageDailyCents: number;
  hasAverage: boolean;
  secondaryLabel: 'Daily allowance' | 'Average per day' | null;
  secondaryAmountCents: number | null;
  daysRemaining: number;
  totalDays: number;
  daysElapsed: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

/**
 * Normalizes a Date to local midnight (00:00:00.000).
 */
function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Computes cycle day counts (total length, elapsed days counting today, and days remaining).
 * - Past cycle (today > endDate): daysElapsed = totalDays, daysRemaining = 0.
 * - Future cycle (today < startDate): daysElapsed = 0, daysRemaining = totalDays.
 * - Current cycle (startDate <= today <= endDate): daysElapsed = 1..totalDays, daysRemaining = totalDays - daysElapsed + 1.
 */
export function getCycleDayMetrics(
  activePeriod: BudgetPeriod,
  now: Date = new Date()
): CycleDayMetrics {
  const startDate = parseDateKey(activePeriod.startDate);
  const endDate = parseDateKey(activePeriod.endDate);
  const today = toLocalMidnight(now);
  const todayKey = formatDateKey(today);

  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
  );

  if (today > endDate) {
    return {
      totalDays,
      daysElapsed: totalDays,
      daysRemaining: 0,
      isPast: true,
      isCurrent: false,
      isFuture: false,
      todayKey,
    };
  }

  if (today < startDate) {
    return {
      totalDays,
      daysElapsed: 0,
      daysRemaining: totalDays,
      isPast: false,
      isCurrent: false,
      isFuture: true,
      todayKey,
    };
  }

  const rawElapsed = Math.round((today.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  const daysElapsed = Math.max(1, Math.min(totalDays, rawElapsed));
  const daysRemaining = Math.max(1, totalDays - daysElapsed + 1);

  return {
    totalDays,
    daysElapsed,
    daysRemaining,
    isPast: false,
    isCurrent: true,
    isFuture: false,
    todayKey,
  };
}

/**
 * Returns whether an entry is an active (non-pending-unrated) expense.
 */
export function isCountableExpense(entry: FinanceEntry): boolean {
  if (entry.type !== 'expense') return false;
  const isPendingWithoutRate =
    entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0);
  return !isPendingWithoutRate;
}

/**
 * Extracts the integer cents amount in home currency for an entry.
 */
export function getEntryHomeCents(entry: FinanceEntry): number {
  return entry.homeAmount ?? entry.amount ?? 0;
}

/**
 * Calculates the daily average spending for a budget cycle:
 * - Current cycle: total spent so far (date <= today) ÷ days elapsed (counting today, minimum 1).
 * - Past cycle: total spent in cycle ÷ full cycle length (totalDays).
 * - Future cycle, or zero countable expenses so far: hasAverage = false, averageDailyCents = 0.
 */
export function calculateDailyAverageMetrics(
  entries: FinanceEntry[],
  activePeriod: BudgetPeriod,
  now: Date = new Date()
): DailyAverageMetrics {
  const dayMetrics = getCycleDayMetrics(activePeriod, now);

  if (dayMetrics.isFuture || dayMetrics.daysElapsed <= 0) {
    return {
      totalExpensesSoFarCents: 0,
      daysElapsed: dayMetrics.daysElapsed,
      averageDailyCents: 0,
      hasAverage: false,
    };
  }

  const cutoffDateKey = dayMetrics.isPast ? activePeriod.endDate : dayMetrics.todayKey;

  let totalExpensesSoFarCents = 0;
  let countedEntries = 0;

  for (const entry of entries) {
    if (!isCountableExpense(entry)) continue;
    if (entry.date < activePeriod.startDate || entry.date > activePeriod.endDate) continue;
    if (entry.date > cutoffDateKey) continue;

    totalExpensesSoFarCents += getEntryHomeCents(entry);
    countedEntries += 1;
  }

  if (countedEntries === 0 || totalExpensesSoFarCents <= 0) {
    return {
      totalExpensesSoFarCents: 0,
      daysElapsed: dayMetrics.daysElapsed,
      averageDailyCents: 0,
      hasAverage: false,
    };
  }

  const divisor = dayMetrics.isPast ? dayMetrics.totalDays : Math.max(1, dayMetrics.daysElapsed);
  const averageDailyCents = Math.round(totalExpensesSoFarCents / divisor);

  return {
    totalExpensesSoFarCents,
    daysElapsed: dayMetrics.daysElapsed,
    averageDailyCents,
    hasAverage: averageDailyCents > 0,
  };
}

/**
 * Computes all Home hero card metrics cleanly and deterministically:
 * - Shows "Daily allowance" ONLY when income is logged (periodIncome > 0) OR an overall
 *   budget limit > 0 is set for the cycle.
 * - Otherwise hides "Daily allowance" and shows "Average per day" using the exact same
 *   figure as calculateDailyAverageMetrics (or nothing if there are zero countable expenses so far).
 */
export function calculateHeroCardMetrics(params: {
  summary: PeriodSummary;
  currentEntries: FinanceEntry[];
  activePeriod: BudgetPeriod;
  activeOverallLimit?: BudgetLimit | null;
  now?: Date;
}): HeroCardMetrics {
  const { summary, currentEntries, activePeriod, activeOverallLimit = null, now = new Date() } = params;

  const dayMetrics = getCycleDayMetrics(activePeriod, now);
  const avgMetrics = calculateDailyAverageMetrics(currentEntries, activePeriod, now);

  const hasIncome = summary.periodIncome > 0;
  const hasOverallLimit = Boolean(activeOverallLimit && activeOverallLimit.amount > 0);
  const showDailyAllowance = hasIncome || hasOverallLimit;

  if (hasIncome) {
    const leftToSpendCents = summary.netLeft;
    const dailyAllowanceCents =
      dayMetrics.daysRemaining > 0
        ? Math.round(Math.max(0, leftToSpendCents) / dayMetrics.daysRemaining)
        : 0;

    return {
      hasIncome,
      hasOverallLimit,
      showDailyAllowance: true,
      heroLabel: 'Left to spend',
      heroDisplayMode: 'left',
      heroAmountCents: leftToSpendCents,
      leftToSpendCents,
      dailyAllowanceCents,
      averageDailyCents: avgMetrics.averageDailyCents,
      hasAverage: avgMetrics.hasAverage,
      secondaryLabel: 'Daily allowance',
      secondaryAmountCents: dailyAllowanceCents,
      daysRemaining: dayMetrics.daysRemaining,
      totalDays: dayMetrics.totalDays,
      daysElapsed: dayMetrics.daysElapsed,
      isPast: dayMetrics.isPast,
      isCurrent: dayMetrics.isCurrent,
      isFuture: dayMetrics.isFuture,
    };
  }

  if (hasOverallLimit && activeOverallLimit) {
    const leftToSpendCents = activeOverallLimit.amount - summary.periodExpenses;
    const dailyAllowanceCents =
      dayMetrics.daysRemaining > 0
        ? Math.round(Math.max(0, leftToSpendCents) / dayMetrics.daysRemaining)
        : 0;

    return {
      hasIncome,
      hasOverallLimit,
      showDailyAllowance: true,
      heroLabel: 'Left to spend',
      heroDisplayMode: 'left',
      heroAmountCents: leftToSpendCents,
      leftToSpendCents,
      dailyAllowanceCents,
      averageDailyCents: avgMetrics.averageDailyCents,
      hasAverage: avgMetrics.hasAverage,
      secondaryLabel: 'Daily allowance',
      secondaryAmountCents: dailyAllowanceCents,
      daysRemaining: dayMetrics.daysRemaining,
      totalDays: dayMetrics.totalDays,
      daysElapsed: dayMetrics.daysElapsed,
      isPast: dayMetrics.isPast,
      isCurrent: dayMetrics.isCurrent,
      isFuture: dayMetrics.isFuture,
    };
  }

  return {
    hasIncome: false,
    hasOverallLimit: false,
    showDailyAllowance,
    heroLabel: 'No Income Logged Yet',
    heroDisplayMode: 'spent',
    heroAmountCents: summary.periodExpenses,
    leftToSpendCents: null,
    dailyAllowanceCents: null,
    averageDailyCents: avgMetrics.averageDailyCents,
    hasAverage: avgMetrics.hasAverage,
    secondaryLabel: avgMetrics.hasAverage ? 'Average per day' : null,
    secondaryAmountCents: avgMetrics.hasAverage ? avgMetrics.averageDailyCents : null,
    daysRemaining: dayMetrics.daysRemaining,
    totalDays: dayMetrics.totalDays,
    daysElapsed: dayMetrics.daysElapsed,
    isPast: dayMetrics.isPast,
    isCurrent: dayMetrics.isCurrent,
    isFuture: dayMetrics.isFuture,
  };
}
