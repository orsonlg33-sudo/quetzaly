/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Camera, ChevronRight, X } from 'lucide-react';
import { Category, FinanceEntry, UserSettings, RecurringRule } from '../types/finance';
import { formatCodeAmount, formatTransactionDate } from '../lib/currency';
import { buildEntryDetailPresentation, buildHistoryRowPresentation } from '../lib/entryDisplay';
import { AdaptiveModal } from './AdaptiveModal';

interface EntryListProps {
  entries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
  recurringRules?: RecurringRule[];
  onEdit: (entry: FinanceEntry) => void;
  onDuplicate: (entry: FinanceEntry) => void;
  onDelete: (entry: FinanceEntry) => void;
  onViewReceipt: (entry: FinanceEntry) => void;
  onUpdateRate?: (entry: FinanceEntry, newRate: number) => void;
  onOpenRecurring?: (entry: FinanceEntry) => void;
  showSearch?: boolean;
}

export const EntryList: React.FC<EntryListProps> = ({
  entries,
  categories,
  settings,
  recurringRules,
  onEdit,
  onDuplicate,
  onDelete,
  onViewReceipt,
  onOpenRecurring,
  showSearch = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDetailEntry, setActiveDetailEntry] = useState<FinanceEntry | null>(null);

  // Filter entries by search query if enabled
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      const catName = cat ? cat.name.toLowerCase() : '';
      const note = e.note ? e.note.toLowerCase() : '';
      const amountStr = (e.amount / 100).toString();
      return (
        catName.includes(q) ||
        note.includes(q) ||
        amountStr.includes(q) ||
        e.currency.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, categories]);

  if (entries.length === 0) {
    return (
      <div className="w-full bg-[var(--bg-surface)] rounded-[28px] p-8 border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center">
        <span className="text-3xl mb-2">🌿</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          No transactions found
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
          No entries have been logged yet. Use the central + button below to log one.
        </p>
      </div>
    );
  }

  // Group entries by date
  const groups = new Map<string, FinanceEntry[]>();
  for (const entry of filteredEntries) {
    const list = groups.get(entry.date) || [];
    list.push(entry);
    groups.set(entry.date, list);
  }

  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  const getCategory = (catId: string, type: string): Category => {
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'General',
        emoji: type === 'income' ? '💰' : '📦',
        color: '#706764',
        type: type as Category['type'],
      }
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Bar */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, categories, amounts"
            className="w-full pl-11 pr-4 py-3 text-xs rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="w-full bg-[var(--bg-surface)] rounded-[28px] p-6 border border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
          No transactions match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dateEntries = groups.get(dateKey) || [];
            const dayTotal = dateEntries.reduce((sum, e) => {
              const isPendingWithoutHome =
                e.rateStatus === 'pending' && (!e.homeAmount || e.homeAmount <= 0);
              if (isPendingWithoutHome) return sum;
              const amt = e.homeAmount ?? e.amount ?? 0;
              return e.type === 'expense' ? sum + amt : sum - amt;
            }, 0);

            return (
              <div key={dateKey} className="space-y-1">
                {/* Date Header with Net Total on the Right */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)] px-2 pb-1 border-b border-[var(--border-subtle)]">
                  <span>{formatTransactionDate(dateKey)}</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    {formatCodeAmount(Math.abs(dayTotal), settings.homeCurrency)}
                  </span>
                </div>

                {/* Ledger Rows as accessible buttons sitting on canvas with hairline dividers */}
                <div className="divide-y divide-[var(--border-subtle)]">
                  {dateEntries.map((entry) => {
                    const category = getCategory(entry.categoryId, entry.type);
                    const row = buildHistoryRowPresentation(
                      entry,
                      category,
                      settings.homeCurrency
                    );

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setActiveDetailEntry(entry)}
                        className="group w-full min-h-[44px] flex items-center justify-between py-3 px-2 text-left cursor-pointer hover:bg-[var(--bg-elevated)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl transition-colors gap-2"
                      >
                        {/* Left: Category Emoji & Merchant/Note + Dual Currency or Category Subline */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xl shrink-0" aria-hidden="true">
                            {category.emoji}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs sm:text-[13px] font-semibold text-[var(--text-primary)] truncate">
                                {row.title}
                              </span>
                              {entry.recurringId && (
                                <span
                                  className="text-xs text-[var(--accent)] font-bold shrink-0"
                                  title="Recurring entry"
                                >
                                  ↻
                                </span>
                              )}
                            </div>

                            {row.isForeign && row.conversionLine ? (
                              <p className="text-[11px] text-[var(--text-secondary)] tabular-nums truncate mt-0.5">
                                {row.conversionLine}
                              </p>
                            ) : row.secondaryContext ? (
                              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                                {row.secondaryContext}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Right: Home Currency Amount (expenses primary, income green with +) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {entry.photoUrl && (
                            <Camera className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                          )}

                          <span
                            className={`text-xs sm:text-sm font-semibold tabular-nums ${
                              row.isIncome ? 'text-[var(--income)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {row.primaryAmountText}
                          </span>

                          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/50 group-hover:text-[var(--text-secondary)]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet / Dialog on Tap, Click, or Keyboard Activation */}
      <AdaptiveModal
        id="entry_list_detail_sheet"
        isOpen={Boolean(activeDetailEntry)}
        onClose={() => setActiveDetailEntry(null)}
      >
        {activeDetailEntry && (() => {
          const category = getCategory(activeDetailEntry.categoryId, activeDetailEntry.type);
          const detail = buildEntryDetailPresentation(activeDetailEntry, settings.homeCurrency);
          const trimmedNote = activeDetailEntry.note?.trim();

          return (
            <div className="p-6 space-y-6 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Header: Headline amount, title, & conversion summary */}
                <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)] gap-3">
                  <div className="min-w-0">
                    {trimmedNote && (
                      <p className="text-xs font-semibold text-[var(--text-secondary)] truncate mb-1">
                        {trimmedNote}
                      </p>
                    )}
                    <h3
                      className={`text-3xl font-extrabold tabular-nums tracking-tight ${
                        detail.isIncome ? 'text-[var(--income)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {detail.headlineAmountText}
                    </h3>
                    {detail.isForeign && (
                      <p className="text-xs text-[var(--text-secondary)] tabular-nums mt-1">
                        {detail.originalAmountText} · {detail.rateDirectionText}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveDetailEntry(null)}
                    aria-label="Close transaction details"
                    className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Plain label/value rows with hairline dividers */}
                <div className="divide-y divide-[var(--border-subtle)] text-xs">
                  {detail.isForeign && (
                    <>
                      <div className="py-3 flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">Original amount</span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {detail.originalAmountText}
                        </span>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">Home equivalent</span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {detail.homeEquivalentText}
                        </span>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">Exchange rate</span>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                            {detail.rateDirectionText}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const entry = activeDetailEntry;
                              setActiveDetailEntry(null);
                              onEdit(entry);
                            }}
                            className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">Rate date</span>
                        <span
                          className={
                            activeDetailEntry.rateDate
                              ? 'font-semibold text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)]'
                          }
                        >
                          {detail.rateDateText}
                        </span>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">Rate source</span>
                        <span
                          className={
                            activeDetailEntry.rateSource
                              ? 'font-semibold text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)]'
                          }
                        >
                          {detail.rateSourceText}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Category</span>
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                      <span>{category.emoji}</span>
                      <span>{category.name}</span>
                    </div>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Date</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatTransactionDate(activeDetailEntry.date)}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Note</span>
                    <span
                      className={
                        trimmedNote
                          ? 'font-semibold text-[var(--text-primary)] text-right'
                          : 'text-[var(--text-secondary)] italic'
                      }
                    >
                      {trimmedNote || 'No note'}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Receipt</span>
                    {activeDetailEntry.photoUrl ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(activeDetailEntry)}
                        className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Receipt attached
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const entry = activeDetailEntry;
                          setActiveDetailEntry(null);
                          onEdit(entry);
                        }}
                        className="font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Repeat row */}
                  <div className="py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Repeat</span>
                    <button
                      type="button"
                      onClick={() => {
                        const entry = activeDetailEntry;
                        setActiveDetailEntry(null);
                        if (onOpenRecurring) {
                          onOpenRecurring(entry);
                        }
                      }}
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      {activeDetailEntry.recurringId
                        ? (() => {
                            const rule = recurringRules?.find(
                              (r) => r.id === activeDetailEntry.recurringId
                            );
                            if (!rule) return 'Repeats';
                            if (rule.frequency === 'weekly') return 'Repeats weekly';
                            if (rule.frequency === 'biweekly') return 'Repeats every 2 weeks';
                            if (rule.frequency === 'monthly') return 'Repeats monthly';
                            if (rule.frequency === 'yearly') return 'Repeats yearly';
                            return 'Repeats';
                          })()
                        : 'Does not repeat'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer: Delete red text left, Duplicate outline pill, Edit amber filled pill */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    const entry = activeDetailEntry;
                    setActiveDetailEntry(null);
                    onDelete(entry);
                  }}
                  className="text-xs font-semibold text-[var(--danger)] hover:underline cursor-pointer py-2"
                >
                  Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const entry = activeDetailEntry;
                      setActiveDetailEntry(null);
                      onDuplicate(entry);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const entry = activeDetailEntry;
                      setActiveDetailEntry(null);
                      onEdit(entry);
                    }}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-[var(--accent)] text-black hover:opacity-90 shadow-sm transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </AdaptiveModal>
    </div>
  );
};
