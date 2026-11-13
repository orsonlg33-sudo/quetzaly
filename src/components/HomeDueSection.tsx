/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DueOccurrence, Category, UserSettings } from '../types/finance';
import { formatCents } from '../lib/currency';
import { formatShortDate, getTodayDateString } from '../lib/recurringMath';
import { AdaptiveModal } from './AdaptiveModal';

interface HomeDueSectionProps {
  dueOccurrences: DueOccurrence[];
  categories: Category[];
  settings: UserSettings;
  onAdd: (due: DueOccurrence) => Promise<void>;
  onSkip: (due: DueOccurrence) => Promise<void>;
}

export const HomeDueSection: React.FC<HomeDueSectionProps> = ({
  dueOccurrences,
  categories,
  settings,
  onAdd,
  onSkip,
}) => {
  const [isReviewAllOpen, setIsReviewAllOpen] = useState<boolean>(false);

  if (dueOccurrences.length === 0) return null;

  const today = getTodayDateString();

  const getCategory = (catId: string, type: 'expense' | 'income'): Category => {
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'General',
        emoji: type === 'income' ? '💰' : '📦',
        color: '#706764',
        type,
      }
    );
  };

  // Sort due occurrences descending by date (most recent first)
  const sortedDue = [...dueOccurrences].sort((a, b) => b.date.localeCompare(a.date));
  const mostRecent = sortedDue[0];
  const earlierCount = sortedDue.length - 1;

  const renderDueRow = (due: DueOccurrence, showBorder: boolean = false) => {
    const rule = due.rule;
    const category = getCategory(rule.categoryId, rule.type);
    const isIncome = rule.type === 'income';
    const isToday = due.date === today;
    const dueDateLabel = isToday ? 'Due today' : `Due ${formatShortDate(due.date)}`;

    return (
      <div
        key={`${rule.id}_${due.date}`}
        className={`p-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors ${
          showBorder ? 'border-b border-[var(--border-subtle)]' : ''
        }`}
      >
        {/* Left: Emoji + Name & Due date */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0">{category.emoji}</span>
          <div className="min-w-0 truncate">
            <span className="text-xs font-semibold text-[var(--text-primary)] block truncate">
              {rule.note || category.name}
            </span>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {dueDateLabel}
            </p>
          </div>
        </div>

        {/* Right: Amount + Skip + Add Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-semibold tabular-nums ${
              isIncome ? 'text-[var(--income)]' : 'text-[var(--text-primary)]'
            }`}
          >
            {isIncome ? '+' : ''}
            {formatCents(rule.amount, rule.currency)}
          </span>

          <button
            type="button"
            onClick={() => onSkip(due)}
            className="px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-xl transition-colors cursor-pointer"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={() => onAdd(due)}
            className="px-3 py-1 text-xs font-semibold rounded-full bg-[var(--accent)] text-black shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-1 animate-in fade-in duration-150">
      {/* Header: DUE · N (plain text header, no boxed card wrapper) */}
      <div className="px-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
          DUE · {dueOccurrences.length}
        </span>
      </div>

      {/* Main Single Row Box */}
      <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
        {/* Most recent item row */}
        {renderDueRow(mostRecent)}

        {/* If older ones exist: collapse into a grey line "+ N earlier occurrences", and "Review all" amber text link */}
        {earlierCount > 0 && (
          <div className="px-3.5 py-2 flex items-center justify-between bg-[var(--bg-elevated)]/20 text-xs">
            <span className="text-[var(--text-secondary)] font-medium">
              +{earlierCount} earlier {earlierCount === 1 ? 'occurrence' : 'occurrences'}
            </span>
            <button
              type="button"
              onClick={() => setIsReviewAllOpen(true)}
              className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
            >
              Review all
            </button>
          </div>
        )}
      </div>

      {/* Review All Sheet */}
      <AdaptiveModal
        id="all_due_occurrences_sheet"
        isOpen={isReviewAllOpen}
        onClose={() => setIsReviewAllOpen(false)}
        maxWidthClass="max-w-[480px]"
      >
        <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            All due recurring items ({sortedDue.length})
          </h3>
          <button
            type="button"
            onClick={() => setIsReviewAllOpen(false)}
            className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-1">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {sortedDue.map((due) => renderDueRow(due, false))}
          </div>
        </div>
      </AdaptiveModal>
    </div>
  );
};
