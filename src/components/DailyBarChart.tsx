/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { BudgetPeriod, FinanceEntry, UserSettings } from '../types/finance';
import { formatCents, APP_LOCALE } from '../lib/currency';
import { parseDateKey, formatDateKey } from '../lib/periodMath';
import {
  calculateDailyAverageMetrics,
  getCycleDayMetrics,
  getEntryHomeCents,
  isCountableExpense,
} from '../lib/homeMath';

interface DailyBarChartProps {
  currentEntries: FinanceEntry[];
  activePeriod: BudgetPeriod;
  settings: UserSettings;
  selectedDateFilter: string | null;
  onSelectDateFilter: (dateStr: string | null) => void;
}

export const DailyBarChart: React.FC<DailyBarChartProps> = ({
  currentEntries,
  activePeriod,
  settings,
  selectedDateFilter,
  onSelectDateFilter,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currency = settings.homeCurrency;

  const startDate = parseDateKey(activePeriod.startDate);
  const dayMetrics = getCycleDayMetrics(activePeriod);
  const avgMetrics = calculateDailyAverageMetrics(currentEntries, activePeriod);
  const { totalDays, todayKey } = dayMetrics;
  const { averageDailyCents, hasAverage } = avgMetrics;

  const daysData: Array<{
    dateKey: string;
    dayNum: number;
    shortMonthDay: string;
    formattedDateLabel: string;
    totalCents: number;
  }> = [];

  const dailyMap = new Map<string, number>();

  for (const e of currentEntries) {
    if (isCountableExpense(e)) {
      const amt = getEntryHomeCents(e);
      const prev = dailyMap.get(e.date) || 0;
      dailyMap.set(e.date, prev + amt);
    }
  }

  let todayIndex = -1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const dateKey = formatDateKey(d);
    if (dateKey === todayKey) {
      todayIndex = i;
    }
    const dayNum = i + 1;
    const shortMonthDay = d.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
    const formattedDateLabel = d.toLocaleDateString(APP_LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const totalCents = dailyMap.get(dateKey) || 0;

    daysData.push({
      dateKey,
      dayNum,
      shortMonthDay,
      formattedDateLabel,
      totalCents,
    });
  }

  const todayData = todayIndex >= 0 ? daysData[todayIndex] : null;
  const todayTotalCents = todayData ? todayData.totalCents : 0;

  const maxDailyCents = Math.max(
    1,
    hasAverage ? averageDailyCents * 1.5 : 0,
    ...daysData.map((d) => d.totalCents)
  );
  const avgHeightPct =
    hasAverage && averageDailyCents > 0
      ? Math.min(95, Math.max(5, (averageDailyCents / maxDailyCents) * 100))
      : 0;

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || daysData.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.min(daysData.length - 1, Math.floor(pct * daysData.length));
    setHoveredIndex(index);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    handlePointerMove(e);
  };

  const handlePointerUp = () => {
    if (hoveredIndex !== null) {
      const targetDate = daysData[hoveredIndex].dateKey;
      if (selectedDateFilter === targetDate) {
        onSelectDateFilter(null);
      } else {
        onSelectDateFilter(targetDate);
      }
    }
  };

  const activeIndex = hoveredIndex;
  const activeDay = activeIndex !== null ? daysData[activeIndex] : null;

  // Exact horizontal position for "Today" axis label under today's bar
  const todayPositionPct = todayIndex >= 0 ? ((todayIndex + 0.5) / totalDays) * 100 : 66.6;

  return (
    <div className="w-full flex flex-col gap-2 py-3 select-none">
      {/* Title & One-line summary */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Daily spending
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Today <strong className="text-[var(--text-primary)]">{formatCents(todayTotalCents, currency)}</strong>
          {hasAverage && (
            <>
              {' · '}average {formatCents(averageDailyCents, currency)} a day
            </>
          )}
        </p>
      </div>

      {/* Chart Plotting Area directly on canvas */}
      <div className="relative pt-8 pb-1">
        {/* Dark Tooltip when dragging/tapping */}
        {activeDay && activeIndex !== null && (
          <div
            className="absolute top-0 -translate-x-1/2 pointer-events-none transition-all duration-75 z-20"
            style={{
              left: `${((activeIndex + 0.5) / daysData.length) * 100}%`,
            }}
          >
            <div className="bg-[#14150F] text-[#F2F1EA] dark:bg-[#222520] dark:text-[#F2F1EA] text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg whitespace-nowrap border border-white/10">
              {activeDay.formattedDateLabel} · {formatCents(activeDay.totalCents, currency)}
            </div>
          </div>
        )}

        {/* Plotting area with bars and dashed average line */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoveredIndex(null)}
          className="relative w-full h-36 flex items-end justify-between gap-[2px] touch-none cursor-pointer"
        >
          {/* Dashed Average Line across chart */}
          {hasAverage && averageDailyCents > 0 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-[var(--text-secondary)]/40 pointer-events-none z-0 flex items-center justify-end"
              style={{ bottom: `${avgHeightPct}%` }}
            >
              <span className="text-[9px] text-[var(--text-secondary)] pr-1 -translate-y-2">
                avg
              </span>
            </div>
          )}

          {/* Continuous thin baseline across the chart */}
          <div className="absolute left-0 right-0 bottom-0 h-[1px] bg-[var(--border-subtle)] pointer-events-none" />

          {/* Bars */}
          {daysData.map((day, idx) => {
            const isToday = day.dateKey === todayKey;
            const hasSpend = day.totalCents > 0;
            const heightPct = hasSpend ? (day.totalCents / maxDailyCents) * 100 : 0;
            const isHovered = hoveredIndex === idx;
            const isSelected = selectedDateFilter === day.dateKey;

            return (
              <div
                key={day.dateKey}
                className="flex-1 flex flex-col justify-end h-full min-w-0 z-10"
              >
                {hasSpend ? (
                  <div
                    style={{
                      height: `${Math.max(4, Math.round(heightPct))}%`,
                      backgroundColor: isToday
                        ? 'var(--accent)' // Full Amber
                        : isHovered || isSelected
                        ? 'rgba(232, 163, 23, 0.7)'
                        : 'rgba(232, 163, 23, 0.28)', // Soft amber tint
                    }}
                    className="w-full rounded-t-xs transition-all"
                  />
                ) : (
                  <div className="h-0 w-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Three Axis Labels: start date on left, "Today" under today's bar, end date on right */}
        <div className="relative w-full h-6 pt-2 text-[11px] font-medium text-[var(--text-secondary)]">
          <span className="absolute left-0 bottom-0">
            {daysData[0]?.shortMonthDay}
          </span>

          {todayIndex >= 0 && (
            <span
              className="absolute -translate-x-1/2 bottom-0 font-semibold text-[var(--text-primary)]"
              style={{ left: `${todayPositionPct}%` }}
            >
              Today
            </span>
          )}

          <span className="absolute right-0 bottom-0">
            {daysData[daysData.length - 1]?.shortMonthDay}
          </span>
        </div>
      </div>
    </div>
  );
};
