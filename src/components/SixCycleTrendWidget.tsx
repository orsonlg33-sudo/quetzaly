/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BudgetPeriod, FinanceEntry, UserSettings } from '../types/finance';
import { calculatePeriodSummary, getAllPeriodsWithData, parseDateKey } from '../lib/periodMath';
import { formatCents, APP_LOCALE } from '../lib/currency';

interface SixCycleTrendWidgetProps {
  entries: FinanceEntry[];
  settings: UserSettings;
  currentPeriod: BudgetPeriod;
}

export const SixCycleTrendWidget: React.FC<SixCycleTrendWidgetProps> = ({
  entries,
  settings,
  currentPeriod,
}) => {
  const [hoveredPeriodId, setHoveredPeriodId] = useState<string | null>(null);

  const currency = settings.homeCurrency;

  const allPeriods = getAllPeriodsWithData(entries, settings.monthStartDay || 22, currentPeriod);
  const last6Periods = allPeriods.slice(-6);

  const summaries = last6Periods.map((p) => calculatePeriodSummary(entries, p, settings.rolloverEnabled));

  if (summaries.length < 2) {
    return (
      <div className="w-full py-4 text-center text-xs text-[var(--text-secondary)]">
        Multi-cycle trends appear after your second cycle.
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...summaries.map((s) => Math.max(s.periodIncome, s.periodExpenses))
  );

  const activePeriodId = hoveredPeriodId || currentPeriod.id;
  const activeSummary = summaries.find((s) => s.period.id === activePeriodId) || summaries[summaries.length - 1];

  const formatPeriodMonthYear = (startDateKey: string): string => {
    const d = parseDateKey(startDateKey);
    const month = d.toLocaleDateString(APP_LOCALE, { month: 'short' });
    const year = d.getFullYear();
    return `${month} ${year}`;
  };

  return (
    <div className="w-full flex flex-col gap-3 py-2">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Multi-Cycle Trajectory ({summaries.length} {summaries.length === 1 ? 'Cycle' : 'Cycles'})
        </h3>
        <p className="text-[11px] text-[var(--text-secondary)]">
          Income versus spending trend over time
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-[var(--income)] rounded-sm inline-block" />
          <span className="text-[var(--text-secondary)]">Income</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-[var(--text-primary)] rounded-sm inline-block" />
          <span className="text-[var(--text-secondary)]">Spending</span>
        </span>
      </div>

      {/* Bar chart grid on canvas */}
      <div className="w-full bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-3 flex items-end justify-between gap-3 h-40">
        {summaries.map((s) => {
          const incPct = Math.max(4, Math.round((s.periodIncome / maxVal) * 100));
          const expPct = Math.max(4, Math.round((s.periodExpenses / maxVal) * 100));
          const isCurrent = s.period.id === currentPeriod.id;
          const isSelected = activePeriodId === s.period.id;

          return (
            <div
              key={s.period.id}
              onClick={() => setHoveredPeriodId(s.period.id)}
              onMouseEnter={() => setHoveredPeriodId(s.period.id)}
              className="flex-1 flex flex-col items-center justify-end h-full gap-1 group cursor-pointer min-w-0"
            >
              <div className="flex items-end gap-1 w-full justify-center h-full">
                {/* Income Bar */}
                <div
                  style={{ height: `${s.periodIncome > 0 ? incPct : 4}%` }}
                  className={`w-2.5 sm:w-3.5 rounded-t-sm transition-all ${
                    isSelected ? 'bg-[var(--income)] ring-1 ring-[var(--income)]' : 'bg-[var(--income)]/70 group-hover:bg-[var(--income)]'
                  }`}
                  title={`Income: ${formatCents(s.periodIncome, currency)}`}
                />
                {/* Spending Bar */}
                <div
                  style={{ height: `${s.periodExpenses > 0 ? expPct : 4}%` }}
                  className={`w-2.5 sm:w-3.5 rounded-t-sm transition-all ${
                    isSelected ? 'bg-[var(--text-primary)] ring-1 ring-[var(--text-primary)]' : 'bg-[var(--text-primary)]/70 group-hover:bg-[var(--text-primary)]'
                  }`}
                  title={`Spending: ${formatCents(s.periodExpenses, currency)}`}
                />
              </div>

              <span
                className={`text-[9px] font-semibold truncate tabular-nums ${
                  isCurrent ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)]'
                }`}
              >
                {formatPeriodMonthYear(s.period.startDate)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tap/Hover Readout */}
      {activeSummary && (
        <div className="flex items-center justify-between text-xs px-1 text-[var(--text-secondary)] pt-1">
          <span className="font-semibold text-[var(--text-primary)]">
            {activeSummary.period.label}
          </span>
          <div className="flex items-center gap-3 tabular-nums">
            <span className="text-[var(--income)] font-bold">
              Inc: {formatCents(activeSummary.periodIncome, currency)}
            </span>
            <span className="text-[var(--text-primary)] font-bold">
              Spent: {formatCents(activeSummary.periodExpenses, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
