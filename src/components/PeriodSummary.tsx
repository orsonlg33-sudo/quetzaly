/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Sparkles, Layers } from 'lucide-react';
import { PeriodSummary as PeriodSummaryType, UserSettings, BudgetLimit } from '../types/finance';
import { formatCents } from '../lib/currency';

interface PeriodSummaryProps {
  summary: PeriodSummaryType;
  settings: UserSettings;
  activeLimit?: BudgetLimit | null;
  onOpenLimitModal?: (type: 'overall' | 'category', categoryId?: string) => void;
}

export const PeriodSummary: React.FC<PeriodSummaryProps> = ({
  summary,
  settings,
  activeLimit,
  onOpenLimitModal,
}) => {
  const {
    periodIncome,
    periodExpenses,
    periodBalance,
    carriedOverBefore,
    totalAvailable,
    netLeft,
    effectiveStartingBalance,
  } = summary;

  const isRolloverOn = settings.rolloverEnabled;
  const currency = settings.homeCurrency;

  // Friendly qualitative headline message (never duplicates numerical figures from the metric cards below)
  let headlineMessage = '';
  let headlineSubtext = '';

  if (periodExpenses === 0 && periodIncome === 0) {
    headlineMessage = 'Fresh Budget Cycle';
    headlineSubtext = 'No income or spending logged yet in this cycle';
  } else if (isRolloverOn) {
    if (netLeft >= 0) {
      headlineMessage = 'Budget on Track';
      headlineSubtext = `Remaining available balance: ${formatCents(netLeft, currency)}`;
    } else {
      headlineMessage = 'Budget Exceeded';
      headlineSubtext = `Exceeded available funds by ${formatCents(Math.abs(netLeft), currency)}`;
    }
  } else {
    if (periodBalance >= 0) {
      headlineMessage = 'Spending Within Income';
      headlineSubtext = 'Logged cycle income covers all cycle expenses';
    } else {
      headlineMessage = 'Spending Exceeds Income';
      headlineSubtext = 'Cycle expenses are higher than logged income';
    }
  }

  // Overall Budget Limit calculations
  const limitAmount = activeLimit?.amount || 0;
  const hasLimit = limitAmount > 0;
  const limitRemaining = limitAmount - periodExpenses;
  const limitPercent = hasLimit ? Math.round((periodExpenses / limitAmount) * 100) : 0;
  const clampedPercent = Math.min(100, Math.max(0, limitPercent));

  return (
    <div className="w-full bg-white dark:bg-[#231E1C] rounded-3xl p-5 shadow-xs border border-[#2C2523]/8 dark:border-white/10 flex flex-col gap-4">
      {/* Primary Warm Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#2C2523]/6 dark:border-white/5">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#706764] dark:text-[#B5ADA9] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
            Cycle Balance Overview
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2C2523] dark:text-[#F7F4F0] tracking-tight tabular-nums mt-0.5">
            {headlineMessage}
          </h2>
          <p className="text-xs text-[#706764] dark:text-[#B5ADA9] mt-0.5">
            {headlineSubtext}
          </p>
        </div>

        {/* Home Currency Badge */}
        <div className="self-start sm:self-center px-3 py-1 rounded-full bg-[#F5EFE9] dark:bg-[#2C2624] text-[11px] font-semibold text-[#706764] dark:text-[#B5ADA9]">
          Home Currency: <span className="text-[#2C2523] dark:text-[#F7F4F0]">{currency}</span>
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Income Card */}
        <div className="p-3.5 rounded-2xl bg-[#3D7B5E]/8 dark:bg-[#3D7B5E]/15 border border-[#3D7B5E]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#3D7B5E] dark:text-[#529E7C] flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Income
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-[#2C2523] dark:text-[#F7F4F0] tabular-nums">
            {formatCents(periodIncome, currency)}
          </div>
          <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] mt-0.5">
            Received in cycle
          </span>
        </div>

        {/* Expenses Card */}
        <div className="p-3.5 rounded-2xl bg-[#C85A32]/8 dark:bg-[#C85A32]/15 border border-[#C85A32]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#C85A32] dark:text-[#E07A5F] flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Spending
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-[#2C2523] dark:text-[#F7F4F0] tabular-nums">
            {formatCents(periodExpenses, currency)}
          </div>
          <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] mt-0.5">
            Total expenses logged
          </span>
        </div>

        {/* Cycle Result Card */}
        <div className="p-3.5 rounded-2xl bg-[#F5EFE9] dark:bg-[#2C2624] border border-[#2C2523]/8 dark:border-white/8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#706764] dark:text-[#B5ADA9] flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Net Cycle Result
            </span>
          </div>
          <div
            className={`text-lg sm:text-xl font-bold tabular-nums ${
              periodBalance >= 0 ? 'text-[#3D7B5E] dark:text-[#529E7C]' : 'text-[#C85A32] dark:text-[#E07A5F]'
            }`}
          >
            {formatCents(periodBalance, currency, { showSign: true })}
          </div>
          <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] mt-0.5">
            Cycle income - spending
          </span>
        </div>
      </div>

      {/* Overall Period Budget Limit Progress Bar */}
      {hasLimit ? (
        <div className="p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/8 dark:border-white/8 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2C2523] dark:text-[#F7F4F0]">
                Period Spending Budget
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#F5EFE9] dark:bg-[#2C2624] text-[#706764] dark:text-[#B5ADA9] font-medium">
                {activeLimit?.periodId ? 'Cycle override' : 'Repeating default'}
              </span>
            </div>

            {onOpenLimitModal && (
              <button
                type="button"
                onClick={() => onOpenLimitModal('overall')}
                className="text-[11px] font-semibold text-[#C85A32] hover:underline"
              >
                Edit limit
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 rounded-full bg-[#F5EFE9] dark:bg-[#2C2624] overflow-hidden">
            <div
              style={{ width: `${clampedPercent}%` }}
              className={`h-full transition-all duration-300 rounded-full ${
                limitRemaining >= 0 ? 'bg-[#3D7B5E]' : 'bg-[#C85A32]'
              }`}
            />
          </div>

          {/* Reassuring wording */}
          <div className="flex items-center justify-between text-[11px] text-[#706764] dark:text-[#B5ADA9]">
            <span className="font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
              {limitRemaining >= 0 ? (
                <span>
                  {formatCents(limitRemaining, currency)} left ({100 - limitPercent}% remaining)
                </span>
              ) : (
                <span className="text-[#C85A32] dark:text-[#E07A5F] font-bold">
                  {formatCents(Math.abs(limitRemaining), currency)} over budget
                </span>
              )}
            </span>
            <span>
              Target limit: {formatCents(limitAmount, currency)} ({clampedPercent}% used)
            </span>
          </div>
        </div>
      ) : (
        onOpenLimitModal && (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-dashed border-[#2C2523]/15 dark:border-white/10 text-xs">
            <span className="text-[#706764] dark:text-[#B5ADA9]">
              Track your spending against a cycle limit?
            </span>
            <button
              type="button"
              onClick={() => onOpenLimitModal('overall')}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-[#F5EFE9] dark:bg-[#2C2624] text-[#C85A32] hover:bg-[#E8E2D9] transition-colors"
            >
              + Set budget limit
            </button>
          </div>
        )
      )}

      {/* Pending Rates Banner if any */}
      {summary.pendingCount > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">
              {summary.pendingCount} {summary.pendingCount === 1 ? 'entry waiting for a rate' : 'entries waiting for a rate'}
            </span>
          </div>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
            (Excluded from totals until exchange rate is retrieved)
          </span>
        </div>
      )}

      {/* Carried Over From Before Line */}
      <div className="p-3 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#C85A32] shrink-0" />
          <div>
            <span className="font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
              Carried over from before:
            </span>{' '}
            <span className="font-bold tabular-nums text-[#2C2523] dark:text-[#F7F4F0]">
              {formatCents(carriedOverBefore, currency, { showSign: true })}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
          {isRolloverOn ? (
            <span className="text-[#3D7B5E] dark:text-[#529E7C] font-medium">
              Rollover ON (added to cycle start)
            </span>
          ) : (
            <span>
              Rollover OFF (tracked separately)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
