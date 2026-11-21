/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { BudgetPeriod, Category, FinanceEntry, UserSettings } from '../types/finance';
import { formatCodeAmount, formatTransactionDate } from '../lib/currency';
import {
  CategoryChangeItem,
  InsightsComparisonMode,
  calculateInsightsComparison,
  formatDateRangeLabel,
  getEntryHomeCents,
} from '../lib/insightsMath';
import { AdaptiveModal } from './AdaptiveModal';
import { EarnedVsSpentWidget } from './EarnedVsSpentWidget';

interface InsightsViewProps {
  entries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
  activePeriod: BudgetPeriod;
  previousPeriod: BudgetPeriod;
  currentCalendarPeriod: BudgetPeriod;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onJumpToCurrent: () => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  entries,
  categories,
  settings,
  activePeriod,
  previousPeriod,
  currentCalendarPeriod,
  onPreviousPeriod,
  onNextPeriod,
  onJumpToCurrent,
}) => {
  const [comparisonMode, setComparisonMode] = useState<InsightsComparisonMode>('same_day');
  const [selectedCategoryItem, setSelectedCategoryItem] = useState<CategoryChangeItem | null>(null);

  const homeCurrency = (settings.homeCurrency || 'USD').toUpperCase();

  const comparison = useMemo(() => {
    return calculateInsightsComparison({
      entries,
      categories,
      activePeriod,
      previousPeriod,
      homeCurrency,
      mode: comparisonMode,
    });
  }, [entries, categories, activePeriod, previousPeriod, homeCurrency, comparisonMode]);

  const { ranges } = comparison;
  const currRangeLabel = formatDateRangeLabel(ranges.currentRange);
  const prevRangeLabel = formatDateRangeLabel(ranges.previousRange);
  const isCurrentCycle = activePeriod.id === currentCalendarPeriod.id;

  const renderOverallDelta = () => {
    if (comparison.currentTotalCents === 0 && comparison.previousTotalCents === 0) {
      return 'No spending logged in either comparison window.';
    }
    if (comparison.previousTotalCents === 0) {
      return `New spending this cycle (0 spent in ${prevRangeLabel}).`;
    }
    const absDiff = formatCodeAmount(Math.abs(comparison.totalDiffCents), homeCurrency);
    const prevTotal = formatCodeAmount(comparison.previousTotalCents, homeCurrency);
    const pctText =
      comparison.totalPctChange !== null
        ? ` (${comparison.totalDiffCents > 0 ? '+' : ''}${comparison.totalPctChange}%)`
        : '';

    if (comparison.totalDiffCents > 0) {
      return `${absDiff} more${pctText} than ${prevTotal} in ${prevRangeLabel}.`;
    }
    if (comparison.totalDiffCents < 0) {
      return `${absDiff} less${pctText} than ${prevTotal} in ${prevRangeLabel}.`;
    }
    return `Same total as ${prevTotal} in ${prevRangeLabel}.`;
  };

  const renderEntrySubline = (entry: FinanceEntry) => {
    const isForeign = entry.currency.toUpperCase() !== homeCurrency;
    const datePart = formatTransactionDate(entry.date);
    if (!isForeign) return datePart;
    const origText = formatCodeAmount(entry.amount, entry.currency);
    const homeText = formatCodeAmount(getEntryHomeCents(entry), homeCurrency);
    return `${datePart} · ${origText} · ${homeText}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Cycle Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Insights
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            What changed, and why
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 py-1">
          <button
            type="button"
            onClick={onPreviousPeriod}
            aria-label="Previous cycle"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onJumpToCurrent}
            className="px-2 py-1 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            title={isCurrentCycle ? 'Current cycle' : 'Jump to current cycle'}
          >
            {activePeriod.label}
          </button>

          <button
            type="button"
            onClick={onNextPeriod}
            aria-label="Next cycle"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comparison Mode Controls & Exact Date Ranges */}
      <div className="bg-[var(--bg-surface)] rounded-[28px] p-5 border border-[var(--border-subtle)] space-y-4">
        {ranges.canToggleMode ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Comparison window
            </span>
            <div
              className="inline-flex bg-[var(--bg-elevated)] p-1 rounded-full border border-[var(--border-subtle)] self-start sm:self-auto"
              role="group"
              aria-label="Comparison window"
            >
              <button
                type="button"
                onClick={() => setComparisonMode('same_day')}
                aria-pressed={ranges.mode === 'same_day'}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all cursor-pointer ${
                  ranges.mode === 'same_day'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Through the same day last cycle
              </button>
              <button
                type="button"
                onClick={() => setComparisonMode('full_cycle')}
                aria-pressed={ranges.mode === 'full_cycle'}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all cursor-pointer ${
                  ranges.mode === 'full_cycle'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Full previous cycle
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <span>
              {ranges.cycleStatus === 'completed' ? 'Completed cycle comparison' : 'Upcoming cycle'}
            </span>
          </div>
        )}

        {/* Headline spending change + exact bounds */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--text-primary)]">
              {formatCodeAmount(comparison.currentTotalCents, homeCurrency)}
            </span>
            <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              {currRangeLabel} ({ranges.currentRange.dayCount}d) vs {prevRangeLabel} ({ranges.previousRange.dayCount}d)
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {renderOverallDelta()}
          </p>
        </div>
      </div>

      {/* Ranked Category Spending Changes (Lead Insights) */}
      <div className="bg-[var(--bg-surface)] rounded-[28px] p-5 border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Category changes
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Largest shifts first · Tap a category to see the entries behind it
            </p>
          </div>
        </div>

        {comparison.categories.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            No spending to compare across {currRangeLabel} and {prevRangeLabel}.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {comparison.categories.map((item) => {
              const isIncrease = item.diffCents > 0;
              const isDecrease = item.diffCents < 0;

              return (
                <button
                  key={item.category.id}
                  type="button"
                  onClick={() => setSelectedCategoryItem(item)}
                  className="group w-full min-h-[44px] py-3.5 px-2 text-left flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl transition-colors cursor-pointer"
                >
                  {/* Left: Emoji, Category name, Plain-English explanation */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-xl shrink-0 pt-0.5" aria-hidden="true">
                      {item.category.emoji}
                    </span>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-xs sm:text-[13px] font-semibold text-[var(--text-primary)] block truncate">
                        {item.category.name}
                      </span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                        {item.changeLine}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]/80 tabular-nums">
                        Prev: {formatCodeAmount(item.previousAmountCents, homeCurrency)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Current total, monetary & percentage difference */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right tabular-nums space-y-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] block">
                        {formatCodeAmount(item.currentAmountCents, homeCurrency)}
                      </span>

                      {item.isNewSpending ? (
                        <span className="text-[11px] font-semibold text-[var(--accent)] block">
                          New spending
                        </span>
                      ) : item.diffCents !== 0 ? (
                        <span
                          className={`text-[11px] font-semibold block ${
                            isIncrease
                              ? 'text-[var(--danger)]'
                              : isDecrease
                              ? 'text-[var(--income)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {isIncrease ? '+' : '-'}
                          {formatCodeAmount(item.absDiffCents, homeCurrency)}
                          {item.pctChange !== null
                            ? ` (${item.pctChange > 0 ? `+${item.pctChange}%` : `${item.pctChange}%`})`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-[var(--text-secondary)] block">
                          No change (0%)
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/50 group-hover:text-[var(--text-secondary)]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Earned vs Spent Multi-Cycle Trajectory */}
      <EarnedVsSpentWidget
        entries={entries}
        settings={settings}
        currentPeriod={activePeriod}
      />

      {/* Category Drill-Down Modal */}
      <AdaptiveModal
        id="insights_category_drilldown"
        isOpen={Boolean(selectedCategoryItem)}
        onClose={() => setSelectedCategoryItem(null)}
      >
        {selectedCategoryItem && (
          <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0" aria-hidden="true">
                  {selectedCategoryItem.category.emoji}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                    {selectedCategoryItem.category.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {ranges.mode === 'same_day'
                      ? 'Through the same day last cycle'
                      : 'Full cycle comparison'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategoryItem(null)}
                aria-label="Close category breakdown"
                className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Period Totals Summary */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] tabular-nums">
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] block">
                  {currRangeLabel}
                </span>
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {formatCodeAmount(selectedCategoryItem.currentAmountCents, homeCurrency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[var(--text-secondary)] block">
                  {prevRangeLabel}
                </span>
                <span className="text-base font-bold text-[var(--text-secondary)]">
                  {formatCodeAmount(selectedCategoryItem.previousAmountCents, homeCurrency)}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-medium">
                {selectedCategoryItem.changeLine}
              </div>
            </div>

            {/* Current Period Entries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                <span>Current ({currRangeLabel})</span>
                <span className="tabular-nums text-[var(--text-primary)]">
                  {formatCodeAmount(selectedCategoryItem.currentAmountCents, homeCurrency)}
                </span>
              </div>

              {selectedCategoryItem.currentEntries.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] px-1 py-2">
                  No spending in this range.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)] px-3">
                  {selectedCategoryItem.currentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--text-primary)] truncate">
                          {entry.note?.trim() || selectedCategoryItem.category.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] tabular-nums truncate">
                          {renderEntrySubline(entry)}
                        </p>
                      </div>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                        {formatCodeAmount(getEntryHomeCents(entry), homeCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previous Period Entries */}
            <div className="space-y-2 pb-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                <span>Previous ({prevRangeLabel})</span>
                <span className="tabular-nums text-[var(--text-primary)]">
                  {formatCodeAmount(selectedCategoryItem.previousAmountCents, homeCurrency)}
                </span>
              </div>

              {selectedCategoryItem.previousEntries.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] px-1 py-2">
                  No spending in this comparison range.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)] px-3">
                  {selectedCategoryItem.previousEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--text-primary)] truncate">
                          {entry.note?.trim() || selectedCategoryItem.category.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] tabular-nums truncate">
                          {renderEntrySubline(entry)}
                        </p>
                      </div>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                        {formatCodeAmount(getEntryHomeCents(entry), homeCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AdaptiveModal>
    </div>
  );
};
