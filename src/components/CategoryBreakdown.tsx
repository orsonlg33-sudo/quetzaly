/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Category, FinanceEntry, UserSettings, BudgetLimit } from '../types/finance';
import { formatCents } from '../lib/currency';

interface CategoryBreakdownProps {
  entries: FinanceEntry[];
  previousEntries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
  limits?: BudgetLimit[];
  activePeriodId?: string;
  onOpenLimitModal?: (type: 'overall' | 'category', categoryId?: string) => void;
  onOpenCategoryManager?: () => void;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  entries,
  previousEntries,
  categories,
  settings,
  limits = [],
  activePeriodId,
  onOpenLimitModal,
  onOpenCategoryManager,
}) => {
  const currency = settings.homeCurrency;

  // Aggregate current expenses by category (excluding unrated pending entries)
  const expenseEntries = entries.filter(
    (e) =>
      e.type === 'expense' &&
      !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
  );
  const totalExpenseCents = expenseEntries.reduce(
    (sum, e) => sum + (e.homeAmount ?? e.amount ?? 0),
    0
  );

  const categoryTotals = new Map<string, number>();
  for (const entry of expenseEntries) {
    const current = categoryTotals.get(entry.categoryId) || 0;
    categoryTotals.set(entry.categoryId, current + (entry.homeAmount ?? entry.amount ?? 0));
  }

  // Aggregate previous period expenses by category
  const prevExpenseEntries = previousEntries.filter(
    (e) =>
      e.type === 'expense' &&
      !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
  );
  const prevCategoryTotals = new Map<string, number>();
  for (const entry of prevExpenseEntries) {
    const current = prevCategoryTotals.get(entry.categoryId) || 0;
    prevCategoryTotals.set(entry.categoryId, current + (entry.homeAmount ?? entry.amount ?? 0));
  }

  const hasPreviousCycleData = previousEntries.length > 0 && prevExpenseEntries.length > 0;

  // Create merged breakdown list
  const breakdown = Array.from(categoryTotals.entries())
    .map(([catId, amountCents]) => {
      const category = categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'Uncategorized',
        emoji: '📦',
        color: '#A8A29E',
        type: 'expense' as const,
      };

      const percentage = totalExpenseCents > 0 ? (amountCents / totalExpenseCents) * 100 : 0;
      const prevAmt = prevCategoryTotals.get(catId) || 0;

      let pctChange: number | null = null;
      let isNew = false;

      if (hasPreviousCycleData) {
        if (prevAmt > 0) {
          const diff = amountCents - prevAmt;
          pctChange = Math.round((diff / prevAmt) * 100);
        } else {
          isNew = true;
        }
      }

      return {
        category,
        amountCents,
        percentage,
        prevAmt,
        pctChange,
        isNew,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  if (expenseEntries.length === 0) {
    return (
      <div className="w-full py-6 text-center text-xs text-[var(--text-secondary)]">
        No spending logged yet in this cycle.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 py-2 select-none">
      {/* Title without terracotta pie icon or "5 categories" tag icon */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Spending by category
        </h3>
        {onOpenCategoryManager && (
          <button
            type="button"
            onClick={onOpenCategoryManager}
            className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
          >
            Manage
          </button>
        )}
      </div>

      {/* Segmented Color Bar Visualizer */}
      <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[var(--bg-elevated)]">
        {breakdown.map((item) => (
          <div
            key={item.category.id}
            style={{
              width: `${Math.max(item.percentage, 1.5)}%`,
              backgroundColor: item.category.color,
            }}
            className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
            title={`${item.category.name}: ${item.percentage.toFixed(0)}%`}
          />
        ))}
      </div>

      {/* Plain rows with hairline dividers (no card-inside-card boxes) */}
      <div className="divide-y divide-[var(--border-subtle)] pt-1">
        {breakdown.map((item) => {
          const catLimit =
            limits.find(
              (l) =>
                l.type === 'category' &&
                l.categoryId === item.category.id &&
                l.periodId === activePeriodId
            ) ||
            limits.find(
              (l) =>
                l.type === 'category' &&
                l.categoryId === item.category.id &&
                !l.periodId
            );

          const hasCatLimit = catLimit && catLimit.amount > 0;
          const limitRemaining = hasCatLimit ? catLimit.amount - item.amountCents : 0;
          const limitPercent = hasCatLimit
            ? Math.round((item.amountCents / catLimit.amount) * 100)
            : 0;
          const clampedPercent = Math.min(100, Math.max(0, limitPercent));
          const isOverLimit = limitRemaining < 0;

          return (
            <div
              key={item.category.id}
              className="py-3 px-1 flex flex-col gap-2 hover:bg-[var(--bg-elevated)]/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Emoji on left, Name with "58% of spending" underneath */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl shrink-0">{item.category.emoji}</span>

                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--text-primary)] block truncate">
                      {item.category.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {item.percentage.toFixed(0)}% of spending
                    </span>
                  </div>
                </div>

                {/* Amount on right with change underneath as colored text only (no tinted pill) */}
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] tabular-nums block">
                    {formatCents(item.amountCents, currency)}
                  </span>

                  {hasPreviousCycleData && (
                    <span className="text-[11px] block mt-0.5 font-medium tabular-nums">
                      {item.isNew ? (
                        <span className="text-[var(--text-secondary)]">
                          New
                        </span>
                      ) : item.pctChange !== null && item.pctChange !== 0 ? (
                        <span
                          className={
                            item.pctChange > 0
                              ? 'text-[var(--danger)]'
                              : 'text-[var(--income)]'
                          }
                        >
                          {item.pctChange > 0 ? `+${item.pctChange}%` : `${item.pctChange}%`}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">0%</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Thin progress line under row, shown ONLY when that category has a limit */}
              {hasCatLimit && (
                <div className="pt-0.5 space-y-1">
                  <div className="w-full h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      style={{
                        width: `${clampedPercent}%`,
                        backgroundColor: isOverLimit ? 'var(--danger)' : item.category.color,
                      }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    <span className={isOverLimit ? 'text-[var(--danger)] font-bold' : ''}>
                      {isOverLimit
                        ? `${formatCents(Math.abs(limitRemaining), currency)} over`
                        : `${formatCents(limitRemaining, currency)} left`}
                    </span>
                    <span>limit {formatCents(catLimit.amount, currency)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
