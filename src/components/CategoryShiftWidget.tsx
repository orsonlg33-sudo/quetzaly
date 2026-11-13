/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Category, FinanceEntry, UserSettings } from '../types/finance';
import { formatCents } from '../lib/currency';

interface CategoryShiftWidgetProps {
  currentEntries: FinanceEntry[];
  previousEntries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
}

export const CategoryShiftWidget: React.FC<CategoryShiftWidgetProps> = ({
  currentEntries,
  previousEntries,
  categories,
  settings,
}) => {
  const currency = settings.homeCurrency;

  // Filter expense entries
  const currentExpenses = currentEntries.filter(
    (e) => e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
  );
  const prevExpenses = previousEntries.filter(
    (e) => e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
  );

  const currentMap = new Map<string, number>();
  for (const e of currentExpenses) {
    const amt = e.homeAmount ?? e.amount ?? 0;
    currentMap.set(e.categoryId, (currentMap.get(e.categoryId) || 0) + amt);
  }

  const prevMap = new Map<string, number>();
  for (const e of prevExpenses) {
    const amt = e.homeAmount ?? e.amount ?? 0;
    prevMap.set(e.categoryId, (prevMap.get(e.categoryId) || 0) + amt);
  }

  // Combine category IDs with spending in either cycle
  const allCatIds = Array.from(new Set([...currentMap.keys(), ...prevMap.keys()]));

  const shifts = allCatIds
    .map((catId) => {
      const category = categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'General',
        emoji: '📦',
        color: '#706764',
        type: 'expense' as const,
      };
      const currAmt = currentMap.get(catId) || 0;
      const prevAmt = prevMap.get(catId) || 0;
      const diffCents = currAmt - prevAmt;
      let pctChange = 0;
      if (prevAmt > 0) {
        pctChange = Math.round((diffCents / prevAmt) * 100);
      } else if (currAmt > 0) {
        pctChange = 100;
      }

      return {
        category,
        currAmt,
        prevAmt,
        diffCents,
        pctChange,
        absDiff: Math.abs(diffCents),
      };
    })
    .sort((a, b) => b.absDiff - a.absDiff);

  if (shifts.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-[#231E1C] rounded-3xl p-5 shadow-xs border border-[#2C2523]/8 dark:border-white/10 text-center py-6 text-xs text-[#706764] dark:text-[#B5ADA9]">
        No category shifts to compare yet.
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-[#231E1C] rounded-3xl p-5 shadow-xs border border-[#2C2523]/8 dark:border-white/10 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#2C2523] dark:text-[#F7F4F0]">
          Category Shifts vs. Last Cycle
        </h3>
        <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
          Changes in spending per category compared to previous cycle
        </p>
      </div>

      <div className="space-y-2.5">
        {shifts.slice(0, 5).map((item) => {
          const isIncrease = item.diffCents > 0;
          const isDecrease = item.diffCents < 0;

          return (
            <div
              key={item.category.id}
              className="p-3 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Category Color Swatch (Category colors appear ONLY inside charts/swatches) */}
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.category.color }}
                />

                <span className="font-semibold text-[#2C2523] dark:text-[#F7F4F0] truncate">
                  {item.category.name}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right tabular-nums">
                <span className="font-bold text-[#2C2523] dark:text-[#F7F4F0]">
                  {formatCents(item.currAmt, currency)}
                </span>

                <span
                  className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md ${
                    isIncrease
                      ? 'bg-[#C85A32]/10 text-[#C85A32]'
                      : isDecrease
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'text-[#706764]'
                  }`}
                >
                  {isIncrease ? `+${item.pctChange}%` : isDecrease ? `${item.pctChange}%` : '0%'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
