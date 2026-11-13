/**
 * Home screen math & edge-case tests for Quetzaly.
 * Tests daily average, daily allowance gating (income / overall limit), past cycles,
 * zero entries, day-1, today-only, and future-only entries.
 */
import assert from 'node:assert/strict';
import {
  calculateDailyAverageMetrics,
  calculateHeroCardMetrics,
  getCycleDayMetrics,
} from '../src/lib/homeMath';
import { calculatePeriodSummary } from '../src/lib/periodMath';
import { formatCents } from '../src/lib/currency';
import { BudgetLimit, BudgetPeriod, FinanceEntry } from '../src/types/finance';

function makePeriod(): BudgetPeriod {
  return {
    id: 'period_2026-11-01_2026-11-30',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    label: 'Nov 1 – 30, 2026',
    year: 2026,
    month: 10,
  };
}

function makeEntry(overrides: Partial<FinanceEntry> & { id: string; date: string; amount: number }): FinanceEntry {
  const nowTs = Date.now();
  return {
    type: 'expense',
    currency: 'USD',
    homeAmount: overrides.amount,
    rate: 1,
    rateStatus: 'fetched',
    rateEditedManually: false,
    categoryId: 'cat_food',
    createdAt: nowTs,
    updatedAt: nowTs,
    ...overrides,
  };
}

function run() {
  console.log('=== QUETZALY HOME MATH TEST ===\n');
  const period = makePeriod(); // 30-day cycle: 2026-11-01 .. 2026-11-30

  // 1. $22 spent on day 12 of a 30-day cycle -> average = $1.83/day (183 cents)
  const day12 = new Date(2026, 10, 12, 14, 30, 0); // 2026-11-12
  const entriesDay12: FinanceEntry[] = [
    makeEntry({ id: 'e1', date: '2026-11-12', amount: 2200 }),
  ];
  const avgDay12 = calculateDailyAverageMetrics(entriesDay12, period, day12);
  assert.equal(avgDay12.daysElapsed, 12, 'Day 12 elapsed days must be 12');
  assert.equal(avgDay12.totalExpensesSoFarCents, 2200);
  assert.equal(avgDay12.averageDailyCents, 183, '2200 / 12 must round to 183 cents');
  assert.equal(avgDay12.hasAverage, true);
  assert.equal(formatCents(avgDay12.averageDailyCents, 'USD'), '$1.83');
  assert.equal(formatCents(avgDay12.averageDailyCents, 'MXN'), 'MX$1.83');
  console.log(
    `1. $22 spent on day 12 of 30-day cycle -> avg=${avgDay12.averageDailyCents} cents (${formatCents(avgDay12.averageDailyCents, 'USD')} / ${formatCents(avgDay12.averageDailyCents, 'MXN')}) -> PASSED`
  );

  // 2. With no income and no overall limit -> Daily allowance hidden, Average per day shown with exact same figure
  const summaryNoIncome = calculatePeriodSummary(entriesDay12, period, false);
  const heroNoIncomeNoLimit = calculateHeroCardMetrics({
    summary: summaryNoIncome,
    currentEntries: entriesDay12,
    activePeriod: period,
    activeOverallLimit: null,
    now: day12,
  });
  assert.equal(heroNoIncomeNoLimit.showDailyAllowance, false);
  assert.equal(heroNoIncomeNoLimit.dailyAllowanceCents, null);
  assert.equal(heroNoIncomeNoLimit.heroLabel, 'No Income Logged Yet');
  assert.equal(heroNoIncomeNoLimit.heroDisplayMode, 'spent');
  assert.equal(heroNoIncomeNoLimit.heroAmountCents, 2200);
  assert.equal(heroNoIncomeNoLimit.secondaryLabel, 'Average per day');
  assert.equal(heroNoIncomeNoLimit.secondaryAmountCents, avgDay12.averageDailyCents);
  console.log(
    `2. No income & no limit -> showDailyAllowance=${heroNoIncomeNoLimit.showDailyAllowance}, secondary="${heroNoIncomeNoLimit.secondaryLabel}" (${formatCents(heroNoIncomeNoLimit.secondaryAmountCents!, 'USD')}) -> PASSED`
  );

  // 3. With income logged and 10 days left (2026-11-21) -> Daily allowance = left to spend / 10
  const day21 = new Date(2026, 10, 21, 9, 0, 0); // Nov 21..30 = 10 days left
  const entriesWithIncome: FinanceEntry[] = [
    makeEntry({ id: 'inc1', type: 'income', date: '2026-11-01', amount: 15000, categoryId: 'cat_salary' }),
    makeEntry({ id: 'exp1', type: 'expense', date: '2026-11-10', amount: 5000 }),
  ];
  const summaryWithIncome = calculatePeriodSummary(entriesWithIncome, period, false);
  const heroWithIncome = calculateHeroCardMetrics({
    summary: summaryWithIncome,
    currentEntries: entriesWithIncome,
    activePeriod: period,
    activeOverallLimit: null,
    now: day21,
  });
  assert.equal(heroWithIncome.daysRemaining, 10, 'Nov 21..30 must be 10 days left');
  assert.equal(heroWithIncome.showDailyAllowance, true);
  assert.equal(heroWithIncome.heroLabel, 'Left to spend');
  assert.equal(heroWithIncome.leftToSpendCents, 10000);
  assert.equal(heroWithIncome.secondaryLabel, 'Daily allowance');
  assert.equal(heroWithIncome.dailyAllowanceCents, 1000, '10000 / 10 must equal 1000 cents');
  console.log(
    `3. Income logged ($150 - $50 = $100 left) with 10 days left -> Daily allowance=${formatCents(heroWithIncome.dailyAllowanceCents!, 'USD')}/day -> PASSED`
  );

  // 4. With no income, but overall budget limit set and 10 days left -> Daily allowance = (limit - spent) / 10
  const overallLimit: BudgetLimit = {
    id: 'limit_overall',
    type: 'overall',
    amount: 20000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const entriesExpenseOnly: FinanceEntry[] = [
    makeEntry({ id: 'exp2', date: '2026-11-10', amount: 5000 }),
  ];
  const summaryExpenseOnly = calculatePeriodSummary(entriesExpenseOnly, period, false);
  const heroWithLimit = calculateHeroCardMetrics({
    summary: summaryExpenseOnly,
    currentEntries: entriesExpenseOnly,
    activePeriod: period,
    activeOverallLimit: overallLimit,
    now: day21,
  });
  assert.equal(heroWithLimit.daysRemaining, 10);
  assert.equal(heroWithLimit.showDailyAllowance, true);
  assert.equal(heroWithLimit.heroLabel, 'Left to spend');
  assert.equal(heroWithLimit.leftToSpendCents, 15000);
  assert.equal(heroWithLimit.secondaryLabel, 'Daily allowance');
  assert.equal(heroWithLimit.dailyAllowanceCents, 1500, '(20000 - 5000) / 10 = 1500 cents');
  console.log(
    `4. Overall limit ($200 - $50 = $150 left) with 10 days left -> Daily allowance=${formatCents(heroWithLimit.dailyAllowanceCents!, 'USD')}/day -> PASSED`
  );

  // 5. Past cycle -> divides by full cycle length (30 days), daysRemaining = 0
  const afterCycle = new Date(2026, 11, 5, 12, 0, 0); // Dec 5, 2026
  const entriesPast: FinanceEntry[] = [
    makeEntry({ id: 'past1', date: '2026-11-15', amount: 30000 }),
  ];
  const avgPast = calculateDailyAverageMetrics(entriesPast, period, afterCycle);
  const dayMetricsPast = getCycleDayMetrics(period, afterCycle);
  assert.equal(dayMetricsPast.isPast, true);
  assert.equal(dayMetricsPast.daysElapsed, 30);
  assert.equal(dayMetricsPast.daysRemaining, 0);
  assert.equal(avgPast.averageDailyCents, 1000, 'Past cycle must divide by full 30-day length');
  console.log(
    `5. Past cycle ($300 spent in 30-day cycle) -> avg=${formatCents(avgPast.averageDailyCents, 'USD')}/day, daysRemaining=${dayMetricsPast.daysRemaining} -> PASSED`
  );

  // 6. Edge case: Zero entries -> no average shown
  const summaryZero = calculatePeriodSummary([], period, false);
  const avgZero = calculateDailyAverageMetrics([], period, day12);
  const heroZero = calculateHeroCardMetrics({
    summary: summaryZero,
    currentEntries: [],
    activePeriod: period,
    activeOverallLimit: null,
    now: day12,
  });
  assert.equal(avgZero.hasAverage, false);
  assert.equal(avgZero.averageDailyCents, 0);
  assert.equal(heroZero.hasAverage, false);
  assert.equal(heroZero.secondaryLabel, null);
  console.log('6. Zero entries -> hasAverage=false, secondaryLabel=null -> PASSED');

  // 7. Edge case: First day of cycle (day 1) - no divide-by-zero & entries only today
  const day1 = new Date(2026, 10, 1, 8, 0, 0); // 2026-11-01
  const avgDay1Empty = calculateDailyAverageMetrics([], period, day1);
  assert.equal(avgDay1Empty.daysElapsed, 1);
  assert.equal(avgDay1Empty.hasAverage, false);
  assert.equal(avgDay1Empty.averageDailyCents, 0);

  const entriesTodayOnly: FinanceEntry[] = [
    makeEntry({ id: 't1', date: '2026-11-01', amount: 1500 }),
  ];
  const avgDay1Today = calculateDailyAverageMetrics(entriesTodayOnly, period, day1);
  assert.equal(avgDay1Today.daysElapsed, 1);
  assert.equal(avgDay1Today.hasAverage, true);
  assert.equal(avgDay1Today.averageDailyCents, 1500);
  console.log(
    `7. First day of cycle (empty -> no average; today-only $15 -> avg=${formatCents(avgDay1Today.averageDailyCents, 'USD')}) -> PASSED`
  );

  // 8. Edge case: Future-only entries in current cycle & future cycle
  const day5 = new Date(2026, 10, 5, 10, 0, 0); // 2026-11-05
  const entriesFutureOnlyInCurrentCycle: FinanceEntry[] = [
    makeEntry({ id: 'fut1', date: '2026-11-25', amount: 9000 }),
  ];
  const avgFutureInCurrent = calculateDailyAverageMetrics(entriesFutureOnlyInCurrentCycle, period, day5);
  assert.equal(avgFutureInCurrent.hasAverage, false, 'Future-dated expenses must not inflate spent-so-far average');
  assert.equal(avgFutureInCurrent.averageDailyCents, 0);

  const beforeCycle = new Date(2026, 9, 20, 10, 0, 0); // 2026-10-20
  const avgFutureCycle = calculateDailyAverageMetrics(entriesFutureOnlyInCurrentCycle, period, beforeCycle);
  const dayMetricsFuture = getCycleDayMetrics(period, beforeCycle);
  assert.equal(dayMetricsFuture.isFuture, true);
  assert.equal(dayMetricsFuture.daysElapsed, 0);
  assert.equal(dayMetricsFuture.daysRemaining, 30);
  assert.equal(avgFutureCycle.hasAverage, false);
  assert.equal(avgFutureCycle.averageDailyCents, 0);
  console.log('8. Future-only entries & future cycle -> hasAverage=false, no divide-by-zero -> PASSED\n');

  console.log('=== ALL HOME MATH TESTS PASSED ===');
}

try {
  run();
} catch (err: any) {
  console.error('HOME MATH TEST FAILED:', err?.message || err);
  process.exit(1);
}
