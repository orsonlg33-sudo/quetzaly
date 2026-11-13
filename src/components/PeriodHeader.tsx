/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Globe, CalendarDays } from 'lucide-react';
import { BudgetPeriod } from '../types/finance';

interface PeriodHeaderProps {
  currentPeriod: BudgetPeriod;
  activePeriod: BudgetPeriod;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onJumpToCurrent: () => void;
  onOpenGlobalView: () => void;
}

export const PeriodHeader: React.FC<PeriodHeaderProps> = ({
  currentPeriod,
  activePeriod,
  onPreviousPeriod,
  onNextPeriod,
  onJumpToCurrent,
  onOpenGlobalView,
}) => {
  const isCurrentPeriod = activePeriod.id === currentPeriod.id;

  return (
    <div className="w-full flex flex-col gap-2 py-2">
      {/* Top Row: App Name & Global View */}
      <div className="flex items-center justify-between px-1">
        <span className="text-base font-bold text-[var(--text-primary)] tracking-tight">
          Quetzaly
        </span>

        <button
          type="button"
          onClick={onOpenGlobalView}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
          title="All-Time Global Summary"
        >
          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Global View</span>
        </button>
      </div>

      {/* Cycle Selector as a plain row with arrows (no card around them) */}
      <div className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          onClick={onPreviousPeriod}
          className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Previous Budget Cycle"
          aria-label="Previous Period"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {activePeriod.label}
            </span>
          </div>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={onJumpToCurrent}
              className="text-[11px] font-semibold text-[var(--accent)] hover:underline mt-0.5"
            >
              Back to Current Cycle
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNextPeriod}
          className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Next Budget Cycle"
          aria-label="Next Period"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
