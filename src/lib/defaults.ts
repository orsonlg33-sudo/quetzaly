/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BudgetLimit,
  Category,
  FinanceEntry,
  RecurringOccurrence,
  RecurringRule,
  UserSettings,
} from '../types/finance';
import { getCurrencyDecimals } from './currency';
import {
  formatDateKey,
  getClampedDay,
  getOffsetPeriod,
  getPeriodForDate,
  parseDateKey,
} from './periodMath';
import { addDays, getDaysInMonth, parseDate } from './recurringMath';

export const DEFAULT_SETTINGS: UserSettings = {
  homeCurrency: 'USD',
  monthStartDay: 1,
  rolloverEnabled: false,
  lastUsedCurrency: 'USD',
  hasDismissedSamplePrompt: false,
  themeMode: 'dark',
  hasSeenWelcome: false,
};

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense categories (8 warm chart colors: #FFB020, #E8761A, #4FD1A1, #C9A86A, #8FA67A, #D9826B, #A8A29E, #7FA8A0)
  { id: 'cat_groceries', name: 'Food & Groceries', emoji: '🍕', color: '#E8761A', type: 'expense', isDefault: true, order: 1 },
  { id: 'cat_dining', name: 'Cafes & Dining', emoji: '☕', color: '#C9A86A', type: 'expense', isDefault: true, order: 2 },
  { id: 'cat_transit', name: 'Transit & Gas', emoji: '🚗', color: '#7FA8A0', type: 'expense', isDefault: true, order: 3 },
  { id: 'cat_housing', name: 'Home & Utilities', emoji: '🏠', color: '#8FA67A', type: 'expense', isDefault: true, order: 4 },
  { id: 'cat_shopping', name: 'Shopping & Gear', emoji: '🛍️', color: '#D9826B', type: 'expense', isDefault: true, order: 5 },
  { id: 'cat_leisure', name: 'Entertainment & Fun', emoji: '🍿', color: '#FFB020', type: 'expense', isDefault: true, order: 6 },
  { id: 'cat_health', name: 'Health & Pharmacy', emoji: '💊', color: '#4FD1A1', type: 'expense', isDefault: true, order: 7 },
  { id: 'cat_bills', name: 'Subscriptions & Bills', emoji: '📱', color: '#E8761A', type: 'expense', isDefault: true, order: 8 },
  { id: 'cat_other_exp', name: 'General & Misc', emoji: '📦', color: '#A8A29E', type: 'expense', isDefault: true, order: 9 },

  // Income categories
  { id: 'cat_salary', name: 'Salary & Wages', emoji: '💼', color: '#4FD1A1', type: 'income', isDefault: true, order: 1 },
  { id: 'cat_freelance', name: 'Side Projects & Freelance', emoji: '💻', color: '#8FA67A', type: 'income', isDefault: true, order: 2 },
  { id: 'cat_investments', name: 'Investments & Returns', emoji: '📈', color: '#7FA8A0', type: 'income', isDefault: true, order: 3 },
  { id: 'cat_gifts', name: 'Gifts & Refunds', emoji: '🎁', color: '#FFB020', type: 'income', isDefault: true, order: 4 },
  { id: 'cat_other_inc', name: 'Other Income', emoji: '💰', color: '#C9A86A', type: 'income', isDefault: true, order: 5 },
];

/**
 * Fixed, documented offline exchange rate table for sample data (units per 1 USD).
 * Derived ratios:
 * - 1 GBP = 1.2500 USD = 25.0000 MXN
 * - 1 MXN = 0.0400 GBP = 0.0500 USD (e.g. MXN 450.00 = GBP 18.00)
 * - 1 USD = 0.8000 GBP = 20.0000 MXN
 */
export const SAMPLE_RATE_DATE = '2026-11-15';
export const SAMPLE_RATE_SOURCE = 'Quetzaly Sample Rates';
export const SAMPLE_RATES_FROM_USD: Record<string, number> = {
  USD: 1.0,
  GBP: 0.8,
  MXN: 20.0,
  EUR: 0.92,
  CAD: 1.38,
  AUD: 1.52,
  CHF: 0.88,
  JPY: 150.0,
  BRL: 5.7,
  COP: 4200.0,
  ARS: 980.0,
  CLP: 950.0,
  GTQ: 7.75,
};

export function getSampleRateConversion(
  amountMinorUnits: number,
  fromCurrency: string,
  toCurrency: string
): {
  homeAmount: number;
  rate: number;
  rateDate?: string;
  rateSource?: string;
} {
  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();

  if (from === to) {
    return {
      homeAmount: amountMinorUnits,
      rate: 1.0,
    };
  }

  const fromPerUsd = SAMPLE_RATES_FROM_USD[from] ?? 1.0;
  const toPerUsd = SAMPLE_RATES_FROM_USD[to] ?? 1.0;
  const fromDecimals = getCurrencyDecimals(from);
  const toDecimals = getCurrencyDecimals(to);
  const decimalScale = Math.pow(10, toDecimals - fromDecimals);
  const rate = (toPerUsd / fromPerUsd) * decimalScale;
  const homeAmount = Math.round(amountMinorUnits * rate);

  return {
    homeAmount,
    rate,
    rateDate: SAMPLE_RATE_DATE,
    rateSource: SAMPLE_RATE_SOURCE,
  };
}

function diffDaysInclusive(startKey: string, endKey: string): number {
  const startMs = parseDateKey(startKey).getTime();
  const endMs = parseDateKey(endKey).getTime();
  return Math.max(0, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
}

function clampDate(key: string, minKey: string, maxKey: string): string {
  if (key < minKey) return minKey;
  if (key > maxKey) return maxKey;
  return key;
}

function subtractOneMonthClamped(dateKey: string): string {
  const { year, month, day } = parseDate(dateKey);
  let targetMonth = month - 1;
  let targetYear = year;
  if (targetMonth < 1) {
    targetMonth = 12;
    targetYear -= 1;
  }
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(day, maxDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export interface CrossBorderSampleBundle {
  entries: FinanceEntry[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  limits: BudgetLimit[];
}

/**
 * Generates a realistic cross-border demo bundle with deterministic IDs:
 * - Monthly GBP 1,800 salary
 * - Daily/weekly MXN spending (groceries, cafes, Librería Gandhi MXN 450, transit, pharmacy)
 * - Recurring USD 18.00 subscription (posted in both previous & current cycles)
 * - Monthly MXN 9,500 rent recurring rule due before the next payday (posted in prior cycle,
 *   scheduled upcoming in current cycle so it is NOT counted as paid current spending yet)
 * - Category budget limit for Food & Groceries
 * - Everything tagged `isSample: true` for surgical removal
 */
export function generateCrossBorderSampleData(
  homeCurrency: string = 'GBP',
  currentPeriodStartDate?: string,
  monthStartDay: number = 1,
  now: Date = new Date()
): CrossBorderSampleBundle {
  const normalizedHome = (homeCurrency || 'USD').toUpperCase();
  const todayKey = formatDateKey(now);

  // Derive active period respecting monthStartDay (and honoring explicit currentPeriodStartDate if passed)
  const inferredPeriod = currentPeriodStartDate
    ? getPeriodForDate(parseDateKey(currentPeriodStartDate), monthStartDay)
    : getPeriodForDate(now, monthStartDay);
  const currentPeriod = inferredPeriod;
  const prevPeriod = getOffsetPeriod(currentPeriod, -1, monthStartDay);

  const effectiveToday = clampDate(todayKey, currentPeriod.startDate, currentPeriod.endDate);
  const elapsedSpan = diffDaysInclusive(currentPeriod.startDate, effectiveToday);

  const currDateAt = (step: number, totalSteps: number): string => {
    if (elapsedSpan === 0) return currentPeriod.startDate;
    const offset = Math.min(elapsedSpan, Math.round((elapsedSpan * step) / totalSteps));
    return clampDate(addDays(currentPeriod.startDate, offset), currentPeriod.startDate, effectiveToday);
  };

  // Place previous-cycle entries within the early-to-mid portion of prevPeriod so both
  // "Through the same day last cycle" and "Full previous cycle" comparisons are meaningful.
  const prevSpan = diffDaysInclusive(prevPeriod.startDate, prevPeriod.endDate);
  const prevDateAt = (preferredOffset: number): string => {
    const clampedOffset = Math.min(prevSpan, Math.max(0, preferredOffset));
    return clampDate(addDays(prevPeriod.startDate, clampedOffset), prevPeriod.startDate, prevPeriod.endDate);
  };

  // Rent schedule: due before the next payday (strictly inside currentPeriod, after today if possible)
  const upcomingRentDate =
    effectiveToday < currentPeriod.endDate
      ? clampDate(addDays(effectiveToday, 4), addDays(effectiveToday, 1), currentPeriod.endDate)
      : currentPeriod.endDate;
  const upcomingRentDay = parseDate(upcomingRentDate).day;
  const prevRentDate = clampDate(
    subtractOneMonthClamped(upcomingRentDate),
    prevPeriod.startDate,
    prevPeriod.endDate
  );

  const baseTimestamp = 1763200000000; // deterministic baseline timestamp

  // 1. Recurring rules (deterministic IDs, isSample: true)
  const recurringRules: RecurringRule[] = [
    {
      id: 'sample_rule_usd_sub',
      type: 'expense',
      amount: 1800, // USD 18.00
      currency: 'USD',
      categoryId: 'cat_bills',
      note: 'Cloud workspace subscription',
      frequency: 'monthly',
      startDate: prevPeriod.startDate,
      monthlyDay: getClampedDay(
        parseDateKey(prevPeriod.startDate).getFullYear(),
        parseDateKey(prevPeriod.startDate).getMonth(),
        monthStartDay
      ),
      active: true,
      autoAdd: true,
      isSample: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
    },
    {
      id: 'sample_rule_rent',
      type: 'expense',
      amount: 950000, // MXN 9,500.00
      currency: 'MXN',
      categoryId: 'cat_housing',
      note: 'Mexico City apartment rent',
      frequency: 'monthly',
      startDate: prevRentDate,
      monthlyDay: upcomingRentDay,
      active: true,
      autoAdd: false,
      isSample: true,
      createdAt: baseTimestamp - 1000,
      updatedAt: baseTimestamp - 1000,
    },
  ];

  // Helper to construct entries cleanly with offline sample rate conversion
  type SampleEntrySeed = {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    currency: string;
    date: string;
    categoryId: string;
    note: string;
    recurringId?: string;
    occurrenceDate?: string;
  };

  const seeds: SampleEntrySeed[] = [
    // --- PREVIOUS CYCLE ---
    {
      id: 'sample_entry_prev_salary',
      type: 'income',
      amount: 180000, // GBP 1,800.00
      currency: 'GBP',
      date: prevPeriod.startDate,
      categoryId: 'cat_salary',
      note: 'UK remote salary (GBP)',
    },
    {
      id: 'sample_entry_prev_usd_sub',
      type: 'expense',
      amount: 1800, // USD 18.00
      currency: 'USD',
      date: prevPeriod.startDate,
      categoryId: 'cat_bills',
      note: 'Cloud workspace subscription',
      recurringId: 'sample_rule_usd_sub',
      occurrenceDate: prevPeriod.startDate,
    },
    {
      id: 'sample_entry_prev_groceries_1',
      type: 'expense',
      amount: 162000, // MXN 1,620.00
      currency: 'MXN',
      date: prevDateAt(1),
      categoryId: 'cat_groceries',
      note: 'Mercado Medellín produce',
    },
    {
      id: 'sample_entry_prev_dining',
      type: 'expense',
      amount: 64000, // MXN 640.00
      currency: 'MXN',
      date: prevDateAt(3),
      categoryId: 'cat_dining',
      note: 'Café Nin breakfast',
    },
    {
      id: 'sample_entry_prev_transit',
      type: 'expense',
      amount: 42000, // MXN 420.00
      currency: 'MXN',
      date: prevDateAt(5),
      categoryId: 'cat_transit',
      note: 'Metro & Ecobici pass',
    },
    {
      id: 'sample_entry_prev_groceries_2',
      type: 'expense',
      amount: 150000, // MXN 1,500.00 (prev groceries total = MXN 3,120.00)
      currency: 'MXN',
      date: prevDateAt(8),
      categoryId: 'cat_groceries',
      note: 'Superama weekly shop',
    },
    {
      id: 'sample_entry_prev_shopping',
      type: 'expense',
      amount: 78000, // MXN 780.00
      currency: 'MXN',
      date: prevDateAt(Math.min(prevSpan, 14)),
      categoryId: 'cat_shopping',
      note: 'Home & desk essentials',
    },
    {
      id: 'sample_entry_prev_rent',
      type: 'expense',
      amount: 950000, // MXN 9,500.00
      currency: 'MXN',
      date: prevRentDate,
      categoryId: 'cat_housing',
      note: 'Mexico City apartment rent',
      recurringId: 'sample_rule_rent',
      occurrenceDate: prevRentDate,
    },

    // --- CURRENT CYCLE (all <= effectiveToday) ---
    {
      id: 'sample_entry_curr_salary',
      type: 'income',
      amount: 180000, // GBP 1,800.00
      currency: 'GBP',
      date: currentPeriod.startDate,
      categoryId: 'cat_salary',
      note: 'UK remote salary (GBP)',
    },
    {
      id: 'sample_entry_curr_usd_sub',
      type: 'expense',
      amount: 1800, // USD 18.00
      currency: 'USD',
      date: currentPeriod.startDate,
      categoryId: 'cat_bills',
      note: 'Cloud workspace subscription',
      recurringId: 'sample_rule_usd_sub',
      occurrenceDate: currentPeriod.startDate,
    },
    {
      id: 'sample_entry_curr_groceries_1',
      type: 'expense',
      amount: 248000, // MXN 2,480.00
      currency: 'MXN',
      date: currDateAt(1, 5),
      categoryId: 'cat_groceries',
      note: 'Mercado Roma groceries',
    },
    {
      id: 'sample_entry_curr_dining',
      type: 'expense',
      amount: 92000, // MXN 920.00
      currency: 'MXN',
      date: currDateAt(2, 5),
      categoryId: 'cat_dining',
      note: 'Tacos & espresso in Condesa',
    },
    {
      id: 'sample_entry_curr_gandhi',
      type: 'expense',
      amount: 45000, // MXN 450.00 -> GBP 18.00 when homeCurrency is GBP
      currency: 'MXN',
      date: currDateAt(3, 5),
      categoryId: 'cat_leisure',
      note: 'Librería Gandhi',
    },
    {
      id: 'sample_entry_curr_groceries_2',
      type: 'expense',
      amount: 190000, // MXN 1,900.00 (curr groceries total = MXN 4,380.00, +40% vs prev 3,120)
      currency: 'MXN',
      date: currDateAt(4, 5),
      categoryId: 'cat_groceries',
      note: 'Superama weekly shop',
    },
    {
      id: 'sample_entry_curr_transit',
      type: 'expense',
      amount: 31000, // MXN 310.00
      currency: 'MXN',
      date: effectiveToday,
      categoryId: 'cat_transit',
      note: 'Airport shuttle & Metro',
    },
    {
      id: 'sample_entry_curr_health',
      type: 'expense',
      amount: 58000, // MXN 580.00 (new category spending this cycle)
      currency: 'MXN',
      date: effectiveToday,
      categoryId: 'cat_health',
      note: 'Farmacia San Pablo',
    },
  ];

  const entries: FinanceEntry[] = seeds.map((seed, index) => {
    const conv = getSampleRateConversion(seed.amount, seed.currency, normalizedHome);
    return {
      id: seed.id,
      type: seed.type,
      amount: seed.amount,
      currency: seed.currency,
      homeAmount: conv.homeAmount,
      rate: conv.rate,
      rateStatus: 'fetched',
      rateEditedManually: false,
      ...(conv.rateDate ? { rateDate: conv.rateDate } : {}),
      ...(conv.rateSource ? { rateSource: conv.rateSource } : {}),
      date: seed.date,
      categoryId: seed.categoryId,
      note: seed.note,
      recurringId: seed.recurringId,
      occurrenceDate: seed.occurrenceDate,
      isSample: true,
      createdAt: baseTimestamp - index * 60000,
      updatedAt: baseTimestamp - index * 60000,
    };
  });

  // 2. Recurring occurrences for already-posted historical/current occurrences
  const recurringOccurrences: RecurringOccurrence[] = [
    {
      id: `sample_rule_usd_sub_${prevPeriod.startDate}`,
      ruleId: 'sample_rule_usd_sub',
      date: prevPeriod.startDate,
      status: 'posted',
      entryId: 'sample_entry_prev_usd_sub',
      isSample: true,
      updatedAt: baseTimestamp,
    },
    {
      id: `sample_rule_usd_sub_${currentPeriod.startDate}`,
      ruleId: 'sample_rule_usd_sub',
      date: currentPeriod.startDate,
      status: 'posted',
      entryId: 'sample_entry_curr_usd_sub',
      isSample: true,
      updatedAt: baseTimestamp,
    },
    {
      id: `sample_rule_rent_${prevRentDate}`,
      ruleId: 'sample_rule_rent',
      date: prevRentDate,
      status: 'posted',
      entryId: 'sample_entry_prev_rent',
      isSample: true,
      updatedAt: baseTimestamp,
    },
  ];

  // 3. Category budget limit on Food & Groceries (MXN 4,500.00 converted to homeCurrency)
  const groceriesLimitConverted = getSampleRateConversion(450000, 'MXN', normalizedHome).homeAmount;
  const limits: BudgetLimit[] = [
    {
      id: 'sample_limit_cat_groceries',
      type: 'category',
      categoryId: 'cat_groceries',
      amount: groceriesLimitConverted,
      isSample: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
    },
  ];

  return {
    entries,
    recurringRules,
    recurringOccurrences,
    limits,
  };
}

/**
 * Convenience helper preserving existing callers (returns sample FinanceEntry[]).
 */
export function generateSampleEntries(
  homeCurrency: string = 'MXN',
  currentPeriodStartDate?: string,
  monthStartDay: number = 1
): FinanceEntry[] {
  return generateCrossBorderSampleData(homeCurrency, currentPeriodStartDate, monthStartDay).entries;
}
