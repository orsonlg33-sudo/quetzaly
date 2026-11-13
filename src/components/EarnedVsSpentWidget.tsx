/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BudgetPeriod, FinanceEntry, UserSettings } from '../types/finance';
import { calculatePeriodSummary, getAllPeriodsWithData, parseDateKey } from '../lib/periodMath';
import { formatCents, APP_LOCALE } from '../lib/currency';

interface EarnedVsSpentWidgetProps {
  entries: FinanceEntry[];
  settings: UserSettings;
  currentPeriod: BudgetPeriod;
}

export const EarnedVsSpentWidget: React.FC<EarnedVsSpentWidgetProps> = ({
  entries,
  settings,
  currentPeriod,
}) => {
  const currency = settings.homeCurrency;

  // Retrieve up to 6 cycles newest first
  const allPeriods = getAllPeriodsWithData(entries, settings.monthStartDay || 22, currentPeriod);
  const recentPeriods = allPeriods.slice(-6).reverse();

  const summaries = recentPeriods.map((p) => calculatePeriodSummary(entries, p, settings.rolloverEnabled));

  if (summaries.length === 0) return null;

  // Current cycle summary
  const currentSummary = summaries.find((s) => s.period.id === currentPeriod.id) || summaries[0];
  const keptPercent = currentSummary.periodIncome > 0
    ? Math.max(0, Math.round(((currentSummary.periodIncome - currentSummary.periodExpenses) / currentSummary.periodIncome) * 100))
    : 0;

  const formatCycleDateRange = (startDateKey: string, endDateKey: string): string => {
    const s = parseDateKey(startDateKey);
    const e = parseDateKey(endDateKey);
    const startStr = s.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
    const endStr = e.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
    return `${startStr} – ${endStr}`;
  };

  return (
    <div className="w-full flex flex-col gap-3 py-3 select-none">
      {/* Title & One-line summary */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Earned vs spent
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          You kept {keptPercent}% of your income this cycle
        </p>
      </div>

      {/* Horizontal bars per cycle */}
      <div className="space-y-4 pt-1">
        {summaries.map((s, idx) => {
          const isCurrent = s.period.id === currentPeriod.id;
          const income = s.periodIncome;
          const expenses = s.periodExpenses;

          // Fraction of income spent
          const spentPct = income > 0 ? Math.min(100, Math.round((expenses / income) * 100)) : 0;

          return (
            <div key={s.period.id} className="space-y-1.5">
              {/* Row Header: Date range on left, "MX$2,918 of MX$20,000" on right */}
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {formatCycleDateRange(s.period.startDate, s.period.endDate)}
                </span>
                <span className={`tabular-nums ${isCurrent ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
                  <strong>{formatCents(expenses, currency, { dropZeroDecimals: true } as any)}</strong> of {formatCents(income, currency, { dropZeroDecimals: true } as any)}
                </span>
              </div>

              {/* Horizontal Bar: spending in amber over soft green track for income */}
              <div
                className={`w-full h-3 rounded-full overflow-hidden transition-all ${
                  isCurrent
                    ? 'bg-[#4FD1A1]/25 dark:bg-[#4FD1A1]/20' // soft green track for income
                    : 'bg-[#4FD1A1]/15 dark:bg-[#4FD1A1]/10 opacity-70' // older cycles muted
                }`}
              >
                <div
                  style={{ width: `${spentPct}%` }}
                  className={`h-full rounded-full transition-all ${
                    isCurrent
                      ? 'bg-[var(--accent)]' // spending portion in amber at full strength
                      : 'bg-[var(--accent)]/60' // older cycles muted
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
