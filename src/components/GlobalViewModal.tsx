/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Globe, Calendar, ArrowRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { BudgetPeriod, FinanceEntry, UserSettings } from '../types/finance';
import { calculatePeriodSummary, getAllPeriodsWithData } from '../lib/periodMath';
import { formatCents } from '../lib/currency';
import { AdaptiveModal } from './AdaptiveModal';

interface GlobalViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: FinanceEntry[];
  settings: UserSettings;
  currentPeriod: BudgetPeriod;
  onSelectPeriod: (period: BudgetPeriod) => void;
}

export const GlobalViewModal: React.FC<GlobalViewModalProps> = ({
  isOpen,
  onClose,
  entries,
  settings,
  currentPeriod,
  onSelectPeriod,
}) => {
  if (!isOpen) return null;

  // Calculate all-time totals
  let allTimeIncome = 0;
  let allTimeExpenses = 0;

  for (const entry of entries) {
    const isPendingWithoutRate = entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0);
    if (isPendingWithoutRate) continue;
    const amount = entry.homeAmount ?? entry.amount ?? 0;
    if (entry.type === 'income') {
      allTimeIncome += amount;
    } else {
      allTimeExpenses += amount;
    }
  }

  const allTimeBalance = allTimeIncome - allTimeExpenses;
  const currency = settings.homeCurrency;

  // Get all periods with entries
  const allPeriods = getAllPeriodsWithData(entries, settings.monthStartDay || 22, currentPeriod);

  // Summaries per period (newest period first)
  const periodSummaries = allPeriods
    .map((p) => calculatePeriodSummary(entries, p, settings.rolloverEnabled))
    .reverse();

  return (
    <AdaptiveModal
      id="global_view_modal"
      isOpen={isOpen}
      onClose={onClose}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2523]/8 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#2C2523] dark:text-[#F7F4F0]">
                All-Time Global View
              </h3>
              <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                Lifetime balance and history across budget periods
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#706764] hover:text-[#2C2523] dark:text-[#B5ADA9] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* All-time big card */}
          <div className="p-4 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5 flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#706764] dark:text-[#B5ADA9]">
              All-Time Net Balance
            </span>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${
                allTimeBalance >= 0 ? 'text-[#3D7B5E] dark:text-[#529E7C]' : 'text-[#C85A32] dark:text-[#E07A5F]'
              }`}
            >
              {formatCents(allTimeBalance, currency, { showSign: true })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2C2523]/6 dark:border-white/5 mt-1">
              <div>
                <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] block">
                  Total Income Logged
                </span>
                <span className="text-xs font-bold text-[#3D7B5E] dark:text-[#529E7C] tabular-nums">
                  {formatCents(allTimeIncome, currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] block">
                  Total Expenses Logged
                </span>
                <span className="text-xs font-bold text-[#C85A32] dark:text-[#E07A5F] tabular-nums">
                  {formatCents(allTimeExpenses, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* List of Periods */}
          <div>
            <h4 className="text-xs font-bold text-[#2C2523] dark:text-[#F7F4F0] mb-2 px-1">
              Results by Budget Cycle ({periodSummaries.length})
            </h4>

            <div className="space-y-2">
              {periodSummaries.map((s) => {
                const isCurrent = s.period.id === currentPeriod.id;
                return (
                  <div
                    key={s.period.id}
                    onClick={() => {
                      onSelectPeriod(s.period);
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-[#C85A32]/8 border-[#C85A32]/30 ring-1 ring-[#C85A32]/20'
                        : 'bg-[#FBF9F5] dark:bg-[#191514] border-[#2C2523]/6 dark:border-white/5 hover:border-[#C85A32]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Calendar className="w-4 h-4 text-[#C85A32] shrink-0" />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#2C2523] dark:text-[#F7F4F0] truncate">
                            {s.period.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-md bg-[#C85A32] text-white font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#706764] dark:text-[#B5ADA9]">
                          {s.entryCount} {s.entryCount === 1 ? 'entry' : 'entries'} · Income: {formatCents(s.periodIncome, currency)} · Spent: {formatCents(s.periodExpenses, currency)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          s.periodBalance >= 0 ? 'text-[#3D7B5E] dark:text-[#529E7C]' : 'text-[#C85A32] dark:text-[#E07A5F]'
                        }`}
                      >
                        {formatCents(s.periodBalance, currency, { showSign: true })}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#9E9490]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AdaptiveModal>
  );
};
