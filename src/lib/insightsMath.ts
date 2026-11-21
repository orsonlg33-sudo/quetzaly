/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BudgetPeriod, Category, FinanceEntry } from '../types/finance';
import { APP_LOCALE, formatCodeAmount } from './currency';
import { formatDateKey, parseDateKey } from './periodMath';
import { addDays } from './recurringMath';

export type InsightsComparisonMode = 'same_day' | 'full_cycle';
export type CycleStatus = 'active' | 'completed' | 'future';

export interface DateRangeBound {
  startDate: string; // inclusive YYYY-MM-DD
  endDate: string;   // inclusive YYYY-MM-DD
  dayCount: number;
}

export interface InsightsComparisonRanges {
  cycleStatus: CycleStatus;
  mode: InsightsComparisonMode;
  currentRange: DateRangeBound;
  previousRange: DateRangeBound;
  canToggleMode: boolean;
}

export interface CategoryChangeItem {
  category: Category;
  currentAmountCents: number;
  previousAmountCents: number;
  diffCents: number;
  absDiffCents: number;
  pctChange: number | null;
  isNewSpending: boolean;
  changeLine: string;
  currentEntries: FinanceEntry[];
  previousEntries: FinanceEntry[];
}

export interface InsightsComparisonResult {
  ranges: InsightsComparisonRanges;
  currentTotalCents: number;
  previousTotalCents: number;
  totalDiffCents: number;
  totalPctChange: number | null;
  categories: CategoryChangeItem[];
}

/**
 * Counts inclusive calendar days between two YYYY-MM-DD strings.
 */
export function countDaysInclusive(startDate: string, endDate: string): number {
  if (endDate < startDate) return 0;
  const start = parseDateKey(startDate).getTime();
  const end = parseDateKey(endDate).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Classifies whether a BudgetPeriod is currently in progress, completed, or in the future.
 */
export function classifyCycle(period: BudgetPeriod, now: Date = new Date()): CycleStatus {
  const todayKey = formatDateKey(now);
  if (todayKey < period.startDate) return 'future';
  if (todayKey > period.endDate) return 'completed';
  return 'active';
}

/**
 * Computes exact, inclusive comparison date ranges for current vs previous cycle.
 * - Active cycle: defaults to `'same_day'` ("Through the same day last cycle")
 *   and supports toggling to `'full_cycle'`.
 *   If the previous cycle is shorter than the elapsed day count in the active cycle
 *   (e.g. March day 30 vs 28-day February), stops cleanly at the end of the shorter previous cycle.
 * - Completed cycle: always compares full completed cycles (`'full_cycle'`).
 */
export function getInsightsDateRanges(
  activePeriod: BudgetPeriod,
  previousPeriod: BudgetPeriod,
  requestedMode?: InsightsComparisonMode,
  now: Date = new Date()
): InsightsComparisonRanges {
  const cycleStatus = classifyCycle(activePeriod, now);
  const todayKey = formatDateKey(now);

  const canToggleMode = cycleStatus === 'active';
  const mode: InsightsComparisonMode =
    cycleStatus === 'active'
      ? (requestedMode || 'same_day')
      : 'full_cycle';

  let currEnd = activePeriod.endDate;
  if (cycleStatus === 'active') {
    currEnd = todayKey <= activePeriod.endDate ? todayKey : activePeriod.endDate;
  } else if (cycleStatus === 'future') {
    currEnd = activePeriod.startDate;
  }

  const currentRange: DateRangeBound = {
    startDate: activePeriod.startDate,
    endDate: currEnd,
    dayCount: cycleStatus === 'future' ? 0 : countDaysInclusive(activePeriod.startDate, currEnd),
  };

  let prevEnd = previousPeriod.endDate;
  if (cycleStatus === 'active' && mode === 'same_day') {
    const elapsedDays = Math.max(1, currentRange.dayCount);
    const matchingPrevEnd = addDays(previousPeriod.startDate, elapsedDays - 1);
    prevEnd = matchingPrevEnd <= previousPeriod.endDate ? matchingPrevEnd : previousPeriod.endDate;
  }

  const previousRange: DateRangeBound = {
    startDate: previousPeriod.startDate,
    endDate: prevEnd,
    dayCount: countDaysInclusive(previousPeriod.startDate, prevEnd),
  };

  return {
    cycleStatus,
    mode,
    currentRange,
    previousRange,
    canToggleMode,
  };
}

/**
 * Formats an inclusive YYYY-MM-DD range into a compact, readable label like "Oct 22 – Nov 2".
 */
export function formatDateRangeLabel(range: DateRangeBound): string {
  const start = parseDateKey(range.startDate);
  const end = parseDateKey(range.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endStr = end.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

export function isCountableExpense(entry: FinanceEntry): boolean {
  if (entry.type !== 'expense') return false;
  if (entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0)) {
    return false;
  }
  return true;
}

export function getEntryHomeCents(entry: FinanceEntry): number {
  return entry.homeAmount ?? entry.amount ?? 0;
}

/**
 * Formats a plain-English category change line (e.g. "Food & Groceries increased by GBP 340.00 (+40%)").
 */
export function buildCategoryChangeLine(
  categoryName: string,
  previousCents: number,
  currentCents: number,
  diffCents: number,
  pctChange: number | null,
  homeCurrency: string
): string {
  if (previousCents === 0 && currentCents > 0) {
    return `${categoryName}: New spending (${formatCodeAmount(currentCents, homeCurrency)})`;
  }
  if (diffCents > 0) {
    const pctPart = pctChange !== null ? ` (+${pctChange}%)` : '';
    return `${categoryName} increased by ${formatCodeAmount(diffCents, homeCurrency)}${pctPart}`;
  }
  if (diffCents < 0) {
    const pctPart = pctChange !== null ? ` (${pctChange}%)` : '';
    return `${categoryName} decreased by ${formatCodeAmount(Math.abs(diffCents), homeCurrency)}${pctPart}`;
  }
  return `${categoryName} stayed the same`;
}

/**
 * Computes ranked category spending comparisons between the active period and previous period.
 * Uses saved `homeAmount` values so totals strictly match History and Dashboard.
 */
export function calculateInsightsComparison(params: {
  entries: FinanceEntry[];
  categories: Category[];
  activePeriod: BudgetPeriod;
  previousPeriod: BudgetPeriod;
  homeCurrency: string;
  mode?: InsightsComparisonMode;
  now?: Date;
}): InsightsComparisonResult {
  const {
    entries,
    categories,
    activePeriod,
    previousPeriod,
    homeCurrency,
    mode,
    now = new Date(),
  } = params;

  const ranges = getInsightsDateRanges(activePeriod, previousPeriod, mode, now);

  const countableExpenses = entries.filter(isCountableExpense);

  const currEntriesInRange = countableExpenses
    .filter(
      (e) =>
        ranges.cycleStatus !== 'future' &&
        e.date >= ranges.currentRange.startDate &&
        e.date <= ranges.currentRange.endDate
    )
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (b.createdAt || 0) - (a.createdAt || 0)));

  const prevEntriesInRange = countableExpenses
    .filter(
      (e) =>
        e.date >= ranges.previousRange.startDate &&
        e.date <= ranges.previousRange.endDate
    )
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (b.createdAt || 0) - (a.createdAt || 0)));

  const currByCategory = new Map<string, FinanceEntry[]>();
  const prevByCategory = new Map<string, FinanceEntry[]>();

  let currentTotalCents = 0;
  for (const e of currEntriesInRange) {
    currentTotalCents += getEntryHomeCents(e);
    const list = currByCategory.get(e.categoryId) || [];
    list.push(e);
    currByCategory.set(e.categoryId, list);
  }

  let previousTotalCents = 0;
  for (const e of prevEntriesInRange) {
    previousTotalCents += getEntryHomeCents(e);
    const list = prevByCategory.get(e.categoryId) || [];
    list.push(e);
    prevByCategory.set(e.categoryId, list);
  }

  const allCategoryIds = new Set<string>([...currByCategory.keys(), ...prevByCategory.keys()]);
  const categoryItems: CategoryChangeItem[] = [];

  for (const catId of allCategoryIds) {
    const currList = currByCategory.get(catId) || [];
    const prevList = prevByCategory.get(catId) || [];

    const currentAmountCents = currList.reduce((sum, e) => sum + getEntryHomeCents(e), 0);
    const previousAmountCents = prevList.reduce((sum, e) => sum + getEntryHomeCents(e), 0);

    // Omit categories with zero in both periods
    if (currentAmountCents === 0 && previousAmountCents === 0) {
      continue;
    }

    const category = categories.find((c) => c.id === catId) || {
      id: catId,
      name: 'Uncategorized',
      emoji: '📦',
      color: '#A8A29E',
      type: 'expense' as const,
    };

    const diffCents = currentAmountCents - previousAmountCents;
    const absDiffCents = Math.abs(diffCents);
    const isNewSpending = previousAmountCents === 0 && currentAmountCents > 0;
    const pctChange =
      previousAmountCents > 0
        ? Math.round((diffCents / previousAmountCents) * 100)
        : null;

    const changeLine = buildCategoryChangeLine(
      category.name,
      previousAmountCents,
      currentAmountCents,
      diffCents,
      pctChange,
      homeCurrency
    );

    categoryItems.push({
      category,
      currentAmountCents,
      previousAmountCents,
      diffCents,
      absDiffCents,
      pctChange,
      isNewSpending,
      changeLine,
      currentEntries: currList,
      previousEntries: prevList,
    });
  }

  categoryItems.sort((a, b) => {
    if (b.absDiffCents !== a.absDiffCents) return b.absDiffCents - a.absDiffCents;
    if (b.currentAmountCents !== a.currentAmountCents) return b.currentAmountCents - a.currentAmountCents;
    return a.category.name.localeCompare(b.category.name);
  });

  const totalDiffCents = currentTotalCents - previousTotalCents;
  const totalPctChange =
    previousTotalCents > 0 ? Math.round((totalDiffCents / previousTotalCents) * 100) : null;

  return {
    ranges,
    currentTotalCents,
    previousTotalCents,
    totalDiffCents,
    totalPctChange,
    categories: categoryItems,
  };
}
