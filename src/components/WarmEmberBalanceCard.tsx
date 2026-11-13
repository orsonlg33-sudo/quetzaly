/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BudgetLimit, BudgetPeriod, FinanceEntry, UserSettings, PeriodSummary } from '../types/finance';
import { formatCents } from '../lib/currency';
import { parseDateKey, formatDateKey } from '../lib/periodMath';
import { calculateHeroCardMetrics } from '../lib/homeMath';
import { Flame, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface WarmEmberBalanceCardProps {
  summary: PeriodSummary;
  settings: UserSettings;
  entries: FinanceEntry[];
  currentEntries: FinanceEntry[];
  activePeriod: BudgetPeriod;
  activeOverallLimit?: BudgetLimit | null;
  onOpenNewCycleRecap?: () => void;
}

export const WarmEmberBalanceCard: React.FC<WarmEmberBalanceCardProps> = ({
  summary,
  settings,
  entries,
  currentEntries,
  activePeriod,
  activeOverallLimit = null,
  onOpenNewCycleRecap,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const currency = settings.homeCurrency;
  const { periodIncome, periodExpenses, effectiveStartingBalance } = summary;

  const metrics = calculateHeroCardMetrics({
    summary,
    currentEntries,
    activePeriod,
    activeOverallLimit,
  });

  const startDate = parseDateKey(activePeriod.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Streak calculation (2+ days)
  const entryDates = Array.from(new Set(entries.map((e) => e.date))).sort().reverse();
  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  let checkKey = formatDateKey(checkDate);
  if (!entryDates.includes(checkKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
    checkKey = formatDateKey(checkDate);
  }
  while (entryDates.includes(checkKey)) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
    checkKey = formatDateKey(checkDate);
  }

  // First days of new cycle check (0 to 3 days since start)
  const daysSinceStart = Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const isFirstDaysOfCycle = daysSinceStart >= 0 && daysSinceStart <= 3;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Streak Counter & First-days Recap Link Row */}
      <div className="flex items-center justify-between px-1 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5 font-medium">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 bg-[var(--bg-surface)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
              <Flame className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Logged {streak} days in a row</span>
            </span>
          )}
        </div>

        {isFirstDaysOfCycle && onOpenNewCycleRecap && (
          <button
            type="button"
            onClick={onOpenNewCycleRecap}
            className="flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>View previous cycle recap</span>
          </button>
        )}
      </div>

      {/* Balance Card Hero (Radius 28px, Warm Ember Gradient: #FFB020 to #E8761A dark, #E8A317 to #E8761A light) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))',
        }}
        className="w-full rounded-[28px] p-6 text-[#0F100E] shadow-lg cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.995]"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0F100E]">
            {metrics.heroLabel}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-[#0F100E]">
            <span>
              {metrics.daysRemaining} {metrics.daysRemaining === 1 ? 'day' : 'days'} left
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* 48px Hero Amount (tabular-nums, no monospace) */}
        <div className="text-3xl sm:text-[48px] leading-tight font-bold tabular-nums tracking-tight my-1 text-[#0F100E]">
          {metrics.heroDisplayMode === 'left'
            ? formatCents(metrics.heroAmountCents, currency)
            : `${formatCents(metrics.heroAmountCents, currency)} spent`}
        </div>

        {/* Daily Allowance / Average per day & Secondary Stats */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/15 text-xs font-medium text-[#0F100E]">
          {metrics.secondaryLabel && metrics.secondaryAmountCents !== null ? (
            <div>
              <span className="block text-[11px] text-[#0F100E]/80">{metrics.secondaryLabel}</span>
              <span className="font-bold tabular-nums text-[18px]">
                {formatCents(metrics.secondaryAmountCents, currency)}{' '}
                <span className="text-[12px] font-normal text-[#0F100E]/80">a day</span>
              </span>
            </div>
          ) : (
            <div />
          )}

          <div className="text-right">
            <span className="block text-[11px] text-[#0F100E]/80">Cycle period</span>
            <span className="font-semibold text-[13px]">{activePeriod.label.split(',')[0]}</span>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-black/20 grid grid-cols-3 gap-2 text-center animate-in fade-in duration-200 text-[#0F100E]">
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-80">Income</span>
              <span className="font-bold tabular-nums text-xs">{formatCents(periodIncome, currency)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-80">Spending</span>
              <span className="font-bold tabular-nums text-xs">{formatCents(periodExpenses, currency)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-80">Carried Over</span>
              <span className="font-bold tabular-nums text-xs">{formatCents(effectiveStartingBalance, currency)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
