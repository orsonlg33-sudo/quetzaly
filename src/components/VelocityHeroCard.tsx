/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BudgetPeriod, FinanceEntry, UserSettings, PeriodSummary } from '../types/finance';
import { formatCents, formatTransactionDate } from '../lib/currency';
import { parseDateKey, formatDateKey } from '../lib/periodMath';

interface VelocityHeroCardProps {
  summary: PeriodSummary;
  settings: UserSettings;
  currentEntries: FinanceEntry[];
  previousEntries: FinanceEntry[];
  activePeriod: BudgetPeriod;
}

export const VelocityHeroCard: React.FC<VelocityHeroCardProps> = ({
  summary,
  settings,
  currentEntries,
  previousEntries,
  activePeriod,
}) => {
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const currency = settings.homeCurrency;
  const { periodIncome, periodExpenses, netLeft } = summary;

  // Calculate days remaining in period
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

  const daysRemaining = Math.max(0, totalDays - currentDayNum + 1);

  let dailyAllowance = 0;
  if (periodIncome > 0) {
    const availableLeft = Math.max(0, netLeft);
    dailyAllowance = daysRemaining > 0 ? Math.round(availableLeft / daysRemaining) : 0;
  } else {
    dailyAllowance = currentDayNum > 0 ? Math.round(periodExpenses / currentDayNum) : 0;
  }

  // Build cumulative spending day-by-day arrays
  const dayDates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    dayDates.push(formatDateKey(d));
  }

  const currentDailyMap = new Map<string, number>();
  for (const e of currentEntries) {
    if (e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))) {
      const amt = e.homeAmount ?? e.amount ?? 0;
      currentDailyMap.set(e.date, (currentDailyMap.get(e.date) || 0) + amt);
    }
  }

  const prevExpenseList = previousEntries.filter(
    (e) => e.type === 'expense' && !(e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0))
  );

  const prevDatesAsc = Array.from(new Set(prevExpenseList.map((e) => e.date))).sort();
  const prevDailyMap = new Map<string, number>();
  for (const e of prevExpenseList) {
    const amt = e.homeAmount ?? e.amount ?? 0;
    prevDailyMap.set(e.date, (prevDailyMap.get(e.date) || 0) + amt);
  }

  const currentCumulative: number[] = [];
  let currentRunning = 0;
  for (let i = 0; i < Math.min(currentDayNum, totalDays); i++) {
    const dateKey = dayDates[i];
    currentRunning += currentDailyMap.get(dateKey) || 0;
    currentCumulative.push(currentRunning);
  }

  const prevCumulative: number[] = [];
  let prevRunning = 0;
  for (let i = 0; i < totalDays; i++) {
    const dateKey = prevDatesAsc[i];
    if (dateKey) {
      prevRunning += prevDailyMap.get(dateKey) || 0;
    }
    prevCumulative.push(prevRunning);
  }

  // SVG Dimensions & Padding
  const svgWidth = 540;
  const svgHeight = 170;
  const paddingLeft = 75; // Space for Y-axis labels
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 25;

  const maxVal = Math.max(
    1,
    ...currentCumulative,
    ...prevCumulative
  );

  const getX = (index: number) => {
    if (totalDays <= 1) return paddingLeft;
    return paddingLeft + (index / (totalDays - 1)) * (svgWidth - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    return svgHeight - paddingBottom - (val / maxVal) * (svgHeight - paddingTop - paddingBottom);
  };

  const currentPoints = currentCumulative.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');
  const prevPoints = prevCumulative.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');

  const activeHoverIndex = hoveredDayIndex !== null ? hoveredDayIndex : Math.max(0, currentCumulative.length - 1);
  const activeHoverDate = dayDates[activeHoverIndex] || activePeriod.startDate;
  const activeHoverCurrent = currentCumulative[activeHoverIndex] ?? 0;
  const activeHoverPrev = prevCumulative[activeHoverIndex] ?? 0;

  // English date label for active day (e.g. "Day 20 · Tue, 10 Nov")
  const formattedDayLabel = `Day ${activeHoverIndex + 1} · ${formatTransactionDate(activeHoverDate)}`;

  return (
    <div className="w-full bg-white dark:bg-[#231E1C] rounded-3xl p-5 shadow-xs border border-[#2C2523]/8 dark:border-white/10 flex flex-col gap-5">
      {/* Metrics Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#2C2523]/6 dark:border-white/5 pb-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#706764] dark:text-[#B5ADA9] block">
            {periodIncome > 0 ? 'Remaining to Spend' : 'No Income Logged Yet'}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#2C2523] dark:text-[#F7F4F0] tabular-nums mt-0.5">
            {periodIncome > 0
              ? formatCents(netLeft, currency)
              : `${formatCents(periodExpenses, currency)} spent`}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] block">Days Remaining</span>
            <span className="font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className="border-l border-[#2C2523]/10 dark:border-white/10 pl-4">
            <span className="text-[10px] text-[#706764] dark:text-[#B5ADA9] block">
              {periodIncome > 0 ? 'Daily Safe Allowance' : 'Avg Daily Spend'}
            </span>
            <span className="font-bold text-[#C85A32] tabular-nums">
              {formatCents(dailyAllowance, currency)} / day
            </span>
          </div>
        </div>
      </div>

      {/* Velocity Line Chart Header */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-bold text-[#2C2523] dark:text-[#F7F4F0]">
            Spending Velocity (Cumulative)
          </span>
          <div className="flex items-center gap-3 text-[11px] text-[#706764] dark:text-[#B5ADA9]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#C85A32] rounded-full inline-block" />
              This Cycle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#9E9490] border-t border-dashed border-[#706764] rounded-full inline-block" />
              Last Cycle
            </span>
          </div>
        </div>

        {/* SVG Chart Container */}
        <div className="relative w-full aspect-[2.6/1] sm:aspect-[3.4/1] bg-[#FBF9F5] dark:bg-[#191514] rounded-2xl border border-[#2C2523]/6 dark:border-white/5 p-2 overflow-hidden">
          {currentCumulative.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#706764] dark:text-[#B5ADA9]">
              Day 1 of cycle – velocity chart tracks your cumulative spending against last cycle.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              onMouseLeave={() => setHoveredDayIndex(null)}
            >
              {/* Y-Axis Grid Lines & Values (Max, Midpoint, 0) */}
              {/* Max line */}
              <line
                x1={paddingLeft}
                y1={getY(maxVal)}
                x2={svgWidth - paddingRight}
                y2={getY(maxVal)}
                stroke="currentColor"
                className="text-[#2C2523]/8 dark:text-white/8"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 6}
                y={getY(maxVal) + 3}
                textAnchor="end"
                className="fill-[#706764] dark:fill-[#B5ADA9] text-[9px] tabular-nums"
              >
                {formatCents(maxVal, currency)}
              </text>

              {/* Midpoint line */}
              <line
                x1={paddingLeft}
                y1={getY(maxVal / 2)}
                x2={svgWidth - paddingRight}
                y2={getY(maxVal / 2)}
                stroke="currentColor"
                className="text-[#2C2523]/8 dark:text-white/8"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 6}
                y={getY(maxVal / 2) + 3}
                textAnchor="end"
                className="fill-[#706764] dark:fill-[#B5ADA9] text-[9px] tabular-nums"
              >
                {formatCents(maxVal / 2, currency)}
              </text>

              {/* Zero line */}
              <line
                x1={paddingLeft}
                y1={getY(0)}
                x2={svgWidth - paddingRight}
                y2={getY(0)}
                stroke="currentColor"
                className="text-[#2C2523]/15 dark:text-white/15"
              />
              <text
                x={paddingLeft - 6}
                y={getY(0) + 3}
                textAnchor="end"
                className="fill-[#706764] dark:fill-[#B5ADA9] text-[9px] tabular-nums"
              >
                {formatCents(0, currency)}
              </text>

              {/* Previous Cycle Cumulative Line (faint dashed) */}
              {prevCumulative.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#9E9490"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  strokeOpacity="0.6"
                  points={prevPoints}
                />
              )}

              {/* Current Cycle Cumulative Line (bold accent) */}
              {currentCumulative.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#C85A32"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={currentPoints}
                />
              ) : (
                <circle
                  cx={getX(0)}
                  cy={getY(currentCumulative[0] || 0)}
                  r="4"
                  fill="#C85A32"
                />
              )}

              {/* Interactive Hover Nodes */}
              {currentCumulative.map((val, idx) => {
                const cx = getX(idx);
                const cy = getY(val);
                const isHovered = activeHoverIndex === idx;

                return (
                  <g key={idx} className="cursor-pointer">
                    <rect
                      x={cx - (svgWidth - paddingLeft - paddingRight) / (totalDays * 2)}
                      y="0"
                      width={(svgWidth - paddingLeft - paddingRight) / totalDays}
                      height={svgHeight}
                      fill="transparent"
                      onMouseEnter={() => setHoveredDayIndex(idx)}
                    />

                    {isHovered && (
                      <line
                        x1={cx}
                        y1={paddingTop}
                        x2={cx}
                        y2={svgHeight - paddingBottom}
                        stroke="#C85A32"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.5"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? '5' : '3'}
                      fill="#C85A32"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Hover details readout in strict English date format */}
        <div className="flex items-center justify-between text-[11px] text-[#706764] dark:text-[#B5ADA9] mt-2 px-1">
          <span className="font-medium text-[#2C2523] dark:text-[#F7F4F0]">{formattedDayLabel}</span>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#2C2523] dark:text-[#F7F4F0] tabular-nums">
              This: {formatCents(activeHoverCurrent, currency)}
            </span>
            <span className="text-[#9E9490] tabular-nums">
              Last: {formatCents(activeHoverPrev, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
