/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Category, FinanceEntry, UserSettings, BudgetPeriod, BudgetLimit } from '../types/finance';
import { formatCents } from '../lib/currency';
import { parseDateKey } from '../lib/periodMath';

interface InsightHeaderProps {
  currentEntries: FinanceEntry[];
  previousEntries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
  activePeriod: BudgetPeriod;
  limits?: BudgetLimit[];
}

export const InsightHeader: React.FC<InsightHeaderProps> = ({
  currentEntries,
  previousEntries,
  categories,
  settings,
  activePeriod,
  limits = [],
}) => {
  const currency = settings.homeCurrency;

  const computeInsight = (): string => {
    const activeExpenseEntries = currentEntries.filter(
      (e) => e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
    );

    const activeIncomeEntries = currentEntries.filter(
      (e) => e.type === 'income' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
    );

    const totalIncome = activeIncomeEntries.reduce((sum, e) => sum + (e.homeAmount ?? e.amount ?? 0), 0);
    const totalExpenses = activeExpenseEntries.reduce((sum, e) => sum + (e.homeAmount ?? e.amount ?? 0), 0);

    // Rule A: Budget limit exceeded or nearly reached (>= 85%)
    // Check overall period limit first
    const overallLimit =
      limits.find((l) => l.type === 'overall' && l.periodId === activePeriod.id) ||
      limits.find((l) => l.type === 'overall' && !l.periodId);

    if (overallLimit && overallLimit.amount > 0) {
      if (totalExpenses > overallLimit.amount) {
        return `Period spending budget exceeded by ${formatCents(totalExpenses - overallLimit.amount, currency)}.`;
      }
      const pct = (totalExpenses / overallLimit.amount) * 100;
      if (pct >= 85) {
        return `Period spending budget is at ${pct.toFixed(0)}% of limit (${formatCents(overallLimit.amount - totalExpenses, currency)} left).`;
      }
    }

    // Check category limits next
    const currentCatTotals = new Map<string, number>();
    for (const e of activeExpenseEntries) {
      const amt = e.homeAmount ?? e.amount ?? 0;
      currentCatTotals.set(e.categoryId, (currentCatTotals.get(e.categoryId) || 0) + amt);
    }

    for (const catLimit of limits.filter((l) => l.type === 'category')) {
      if (!catLimit.categoryId || catLimit.amount <= 0) continue;
      const spent = currentCatTotals.get(catLimit.categoryId) || 0;
      const catName = categories.find((c) => c.id === catLimit.categoryId)?.name || 'Category';

      if (spent > catLimit.amount) {
        return `${catName} limit exceeded by ${formatCents(spent - catLimit.amount, currency)}.`;
      }
      const catPct = (spent / catLimit.amount) * 100;
      if (catPct >= 85) {
        return `${catName} limit is at ${catPct.toFixed(0)}% of limit.`;
      }
    }

    // Rule B: Biggest category change versus last cycle (ONLY if previous cycle has entries)
    const prevExpenseEntries = previousEntries.filter(
      (e) => e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
    );

    if (previousEntries.length > 0 && prevExpenseEntries.length > 0) {
      const prevCatTotals = new Map<string, number>();
      for (const e of prevExpenseEntries) {
        const amt = e.homeAmount ?? e.amount ?? 0;
        prevCatTotals.set(e.categoryId, (prevCatTotals.get(e.categoryId) || 0) + amt);
      }

      let topChange: { name: string; pct: number; isIncrease: boolean; absDiff: number } | null = null;

      for (const [catId, currentAmt] of currentCatTotals.entries()) {
        const prevAmt = prevCatTotals.get(catId) || 0;
        if (prevAmt > 0) {
          const diff = currentAmt - prevAmt;
          const pct = Math.round((Math.abs(diff) / prevAmt) * 100);
          if (pct >= 10 && (!topChange || Math.abs(diff) > topChange.absDiff)) {
            const catName = categories.find((c) => c.id === catId)?.name || 'Category';
            topChange = { name: catName, pct, isIncrease: diff > 0, absDiff: Math.abs(diff) };
          }
        }
      }

      if (topChange) {
        return `${topChange.name} is ${topChange.pct}% ${topChange.isIncrease ? 'higher' : 'lower'} than last cycle.`;
      }
    }

    // Rule C: Projection (e.g. "At this pace you will end the cycle with about MX$X left")
    const startDate = parseDateKey(activePeriod.startDate);
    const endDate = parseDateKey(activePeriod.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    let currentDayNum = 1;
    if (today < startDate) {
      currentDayNum = 1;
    } else if (today > endDate) {
      currentDayNum = totalDays;
    } else {
      currentDayNum = Math.max(1, Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    if (totalIncome > 0 && currentDayNum > 0 && totalExpenses > 0) {
      const avgDailyExpense = totalExpenses / currentDayNum;
      const projectedExpenses = Math.round(avgDailyExpense * totalDays);
      const projectedLeft = totalIncome - projectedExpenses;

      if (projectedLeft >= 0) {
        return `At this pace you will end the cycle with about ${formatCents(projectedLeft, currency)} left.`;
      } else {
        return `At this pace you will end the cycle about ${formatCents(Math.abs(projectedLeft), currency)} over income.`;
      }
    }

    // Rule D: Otherwise a neutral line
    return `Cycle active for ${activePeriod.label}.`;
  };

  const insightText = computeInsight();

  return (
    <div className="w-full border-l-3 border-[var(--accent)] pl-3 py-1 my-1">
      <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)] tracking-tight">
        {insightText}
      </p>
    </div>
  );
};
